import { z } from 'zod';
import { AIRecommendationOutputSchema } from '@idp/shared';
import { logger } from '../../utils/logger.js';
import { env } from '../../config/env.js';

export type AIRecommendationOutput = z.infer<typeof AIRecommendationOutputSchema>;

export interface IOpenAIClient {
  generateRecommendation(input: {
    serviceName: string;
    environmentType: string;
    currentCpuRequestM: number;
    currentMemoryRequestMb: number;
    currentReplicas: number;
    metrics: {
      p95CpuM: number;
      avgCpuM: number;
      maxCpuM: number;
      p95MemoryMb: number;
      avgMemoryMb: number;
      maxMemoryMb: number;
      sampleCount: number;
    };
  }): Promise<AIRecommendationOutput>;
}

export class MockOpenAIClient implements IOpenAIClient {
  public failNextRequest: boolean = false;

  async generateRecommendation(input: {
    serviceName: string;
    environmentType: string;
    currentCpuRequestM: number;
    currentMemoryRequestMb: number;
    currentReplicas: number;
    metrics: {
      p95CpuM: number;
      avgCpuM: number;
      maxCpuM: number;
      p95MemoryMb: number;
      avgMemoryMb: number;
      maxMemoryMb: number;
      sampleCount: number;
    };
  }): Promise<AIRecommendationOutput> {
    if (this.failNextRequest) {
      this.failNextRequest = false;
      // Return invalid payload to test retry / rejection
      return { invalid: 'schema-break' } as any;
    }

    const { metrics, currentCpuRequestM, currentMemoryRequestMb, currentReplicas } = input;

    // Grounded heuristic:
    // If P95 CPU is substantially lower than current request (< 30%), recommend right-sizing down with 20% headroom.
    // If P95 CPU is high (> 75%), recommend increasing request to avoid throttling.
    let recommendedCpuReq = Math.max(50, Math.round(metrics.p95CpuM * 1.25));
    let recommendedCpuLim = Math.max(recommendedCpuReq * 2, Math.round(metrics.maxCpuM * 1.5));

    let recommendedMemReq = Math.max(64, Math.round(metrics.p95MemoryMb * 1.25));
    let recommendedMemLim = Math.max(recommendedMemReq * 2, Math.round(metrics.maxMemoryMb * 1.5));

    let recommendedReplicas = currentReplicas;
    const reasoning: string[] = [];

    if (metrics.p95CpuM < currentCpuRequestM * 0.4) {
      reasoning.push(
        `Observed P95 CPU utilization of ${metrics.p95CpuM}m is well below current allocation of ${currentCpuRequestM}m. Downsizing request to ${recommendedCpuReq}m reduces cluster reservation by ${currentCpuRequestM - recommendedCpuReq}m.`
      );
    } else if (metrics.p95CpuM > currentCpuRequestM * 0.8) {
      recommendedCpuReq = Math.round(metrics.p95CpuM * 1.3);
      recommendedCpuLim = recommendedCpuReq * 2;
      reasoning.push(
        `Observed P95 CPU is nearing requested capacity (${metrics.p95CpuM}m / ${currentCpuRequestM}m). Increasing request to ${recommendedCpuReq}m prevents CPU throttling during traffic spikes.`
      );
    } else {
      reasoning.push(
        `CPU reservation (${currentCpuRequestM}m) matches observed P95 demand (${metrics.p95CpuM}m). Request fine-tuned with 25% safety headroom.`
      );
    }

    if (metrics.p95MemoryMb < currentMemoryRequestMb * 0.4) {
      reasoning.push(
        `P95 memory residency of ${metrics.p95MemoryMb}MB shows overprovisioning. Safely lowering request to ${recommendedMemReq}MB frees ${currentMemoryRequestMb - recommendedMemReq}MB of host RAM.`
      );
    } else if (metrics.maxMemoryMb > currentMemoryRequestMb * 0.85) {
      recommendedMemReq = Math.round(metrics.maxMemoryMb * 1.3);
      recommendedMemLim = recommendedMemReq * 2;
      reasoning.push(
        `Peak memory usage reached ${metrics.maxMemoryMb}MB. Raising request to ${recommendedMemReq}MB and limit to ${recommendedMemLim}MB protects against OOMKilled events.`
      );
    } else {
      reasoning.push(
        `Memory utilization is healthy with low fragmentation. Retaining balanced ${recommendedMemReq}MB request.`
      );
    }

    if (input.environmentType === 'prod' && currentReplicas === 1) {
      recommendedReplicas = 2;
      reasoning.push(
        `Production environment requires high availability. Recommend increasing replicas from 1 to 2 to eliminate single point of failure.`
      );
    }

    return {
      cpu_request_m: recommendedCpuReq,
      cpu_limit_m: recommendedCpuLim,
      memory_request_mb: recommendedMemReq,
      memory_limit_mb: recommendedMemLim,
      replicas: recommendedReplicas,
      confidence: 0.94,
      reasoning,
    };
  }
}

export class RealOpenAIClient implements IOpenAIClient {
  async generateRecommendation(input: any): Promise<AIRecommendationOutput> {
    if (!env.OPENAI_API_KEY || env.OPENAI_API_KEY === 'mock-key') {
      logger.info('No live OPENAI_API_KEY; delegating to grounded heuristic client');
      return new MockOpenAIClient().generateRecommendation(input);
    }

    const systemPrompt = `You are a Principal Site Reliability and Platform Engineer.
Given real Kubernetes workload utilization metrics, produce grounded sizing recommendations for container resource requests and limits.
Output strictly conforming to the requested JSON schema. Limit must be greater than or equal to request. Provide actionable reasoning.`;

    const userPrompt = JSON.stringify(input);

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'resource_recommendation',
            schema: {
              type: 'object',
              properties: {
                cpu_request_m: { type: 'integer', minimum: 50 },
                cpu_limit_m: { type: 'integer', minimum: 50 },
                memory_request_mb: { type: 'integer', minimum: 64 },
                memory_limit_mb: { type: 'integer', minimum: 64 },
                replicas: { type: 'integer', minimum: 1, maximum: 20 },
                confidence: { type: 'number', minimum: 0, maximum: 1 },
                reasoning: { type: 'array', items: { type: 'string' } },
              },
              required: [
                'cpu_request_m',
                'cpu_limit_m',
                'memory_request_mb',
                'memory_limit_mb',
                'replicas',
                'confidence',
                'reasoning',
              ],
              additionalProperties: false,
            },
            strict: true,
          },
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: HTTP ${response.status}`);
    }

    const data: any = await response.json();
    const content = data.choices[0]?.message?.content;
    return JSON.parse(content);
  }
}
