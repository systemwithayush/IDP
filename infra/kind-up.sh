#!/usr/bin/env bash
set -euo pipefail

echo "=========================================="
echo " Starting IDP Kind Kubernetes Cluster     "
echo "=========================================="

# Check prerequisites
command -v kind >/dev/null 2>&1 || { echo >&2 "kind is required but not installed. Aborting."; exit 1; }
command -v kubectl >/dev/null 2>&1 || { echo >&2 "kubectl is required but not installed. Aborting."; exit 1; }

CLUSTER_NAME="idp-cluster"

if kind get clusters | grep -q "^${CLUSTER_NAME}$"; then
  echo "Cluster '${CLUSTER_NAME}' already exists. Skipping creation."
else
  echo "Creating kind cluster '${CLUSTER_NAME}'..."
  kind create cluster --config "$(dirname "$0")/kind-config.yaml"
fi

echo "Setting kubectl context to kind-${CLUSTER_NAME}..."
kubectl config use-context "kind-${CLUSTER_NAME}"

echo "Creating namespaces..."
kubectl create namespace idp-system --dry-run=client -o yaml | kubectl apply -f -
kubectl create namespace idp-workloads --dry-run=client -o yaml | kubectl apply -f -

echo "Applying IDP deployer RBAC..."
kubectl apply -f "$(dirname "$0")/k8s/rbac.yaml"

echo "Deploying metrics-server for AI resource advisory..."
kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml
kubectl patch deployment metrics-server -n kube-system --type='json' -p='[{"op":"add","path":"/spec/template/spec/containers/0/args/-","value":"--kubelet-insecure-tls"}]' || true

echo "Deploying Ingress NGINX controller for Kind..."
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/main/deploy/static/provider/kind/deploy.yaml

echo "Waiting for ingress-nginx controller to be ready..."
kubectl wait --namespace ingress-nginx \
  --for=condition=ready pod \
  --selector=app.kubernetes.io/component=controller \
  --timeout=120s || echo "Note: Ingress controller still warming up in background."

echo "=========================================="
echo " Kind cluster initialized successfully!   "
echo " Context: kind-${CLUSTER_NAME}            "
echo " Namespaces: idp-system, idp-workloads    "
echo " RBAC: idp-deployer configured            "
echo "=========================================="

