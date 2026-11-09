import { useState } from 'react';
import { 
  Terminal, 
  Layers, 
  Cpu, 
  ShieldCheck, 
  History, 
  Plus, 
  Activity,
  GitBranch,
  Boxes,
  Search,
  CheckCircle2,
  ArrowRight,
  Eye,
  EyeOff,
  Sparkles,
  ChevronRight,
  RefreshCw,
  FileCode,
  Download,
  AlertTriangle,
  RotateCcw,
  Check,
  Server,
  UserCheck,
  Lock,
  Copy,
  Trash2,
  KeyRound,
  ShieldAlert
} from 'lucide-react';

interface UserPersona {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'lead' | 'developer';
  team: string;
  avatarBg: string;
  avatarColor: string;
  badgeBg: string;
  badgeBorder: string;
  badgeText: string;
  description: string;
  canRevealSecrets: boolean;
  canApproveAI: boolean;
  canDeployProd: boolean;
}

const PERSONAS: UserPersona[] = [
  {
    id: 'u-divya',
    name: 'Divya',
    email: 'divya@idp.internal',
    role: 'admin',
    team: 'Platform Engineering (Core)',
    avatarBg: 'bg-purple-600/30 border-purple-500/60',
    avatarColor: 'text-purple-300',
    badgeBg: 'bg-purple-950/80',
    badgeBorder: 'border-purple-800',
    badgeText: 'text-purple-300',
    description: 'Platform Administrator (Admin Persona) - Full cluster & organization-wide governance, unlimited secrets reveal, quota management, and unconstrained deployments.',
    canRevealSecrets: true,
    canApproveAI: true,
    canDeployProd: true,
  },
  {
    id: 'u-deepak',
    name: 'Deepak',
    email: 'deepak@idp.internal',
    role: 'lead',
    team: 'Payments & Core Services',
    avatarBg: 'bg-blue-600/30 border-blue-500/60',
    avatarColor: 'text-blue-300',
    badgeBg: 'bg-blue-950/80',
    badgeBorder: 'border-blue-800',
    badgeText: 'text-blue-300',
    description: 'Team Lead - Approves AI resource rightsizing, controls staging/production rollouts, and reveals secrets with mandatory audit logging.',
    canRevealSecrets: true,
    canApproveAI: true,
    canDeployProd: true,
  },
  {
    id: 'u-ayush',
    name: 'Ayush',
    email: 'ayush@idp.internal',
    role: 'developer',
    team: 'Product & Full-Stack Engineering',
    avatarBg: 'bg-emerald-600/30 border-emerald-500/60',
    avatarColor: 'text-emerald-300',
    badgeBg: 'bg-emerald-950/80',
    badgeBorder: 'border-emerald-800',
    badgeText: 'text-emerald-300',
    description: 'Developer - Scaffolds services from Golden Paths, triggers rollouts to dev/staging, and requests Lead sign-off for production changes.',
    canRevealSecrets: false,
    canApproveAI: false,
    canDeployProd: false,
  },
];

interface ServiceItem {
  id: string;
  name: string;
  team: string;
  stack: 'node-express' | 'python-fastapi' | 'react-static';
  repoUrl: string;
  status: 'succeeded' | 'rolling_out' | 'failed' | 'building' | 'rolled_back';
  replicas: string;
  env: 'prod' | 'staging' | 'dev';
  lastDeployed: string;
  cpuUsage: string;
  memUsage: string;
}

const INITIAL_SERVICES: ServiceItem[] = [
  {
    id: 'srv-1',
    name: 'auth-gateway',
    team: 'Platform Engineering (Core)',
    stack: 'node-express',
    repoUrl: 'github.com/systemwithayush/auth-gateway',
    status: 'succeeded',
    replicas: '2/2',
    env: 'prod',
    lastDeployed: '4m ago',
    cpuUsage: '140m / 500m',
    memUsage: '210Mi / 512Mi'
  },
  {
    id: 'srv-2',
    name: 'payment-processor',
    team: 'Payments & Core Services',
    stack: 'python-fastapi',
    repoUrl: 'github.com/systemwithayush/payment-processor',
    status: 'rolling_out',
    replicas: '1/2',
    env: 'staging',
    lastDeployed: 'Just now',
    cpuUsage: '220m / 400m',
    memUsage: '310Mi / 512Mi'
  },
  {
    id: 'srv-3',
    name: 'checkout-frontend',
    team: 'Payments & Core Services',
    stack: 'react-static',
    repoUrl: 'github.com/systemwithayush/checkout-web',
    status: 'succeeded',
    replicas: '3/3',
    env: 'prod',
    lastDeployed: '1h ago',
    cpuUsage: '45m / 200m',
    memUsage: '85Mi / 256Mi'
  },
  {
    id: 'srv-4',
    name: 'notification-worker',
    team: 'Platform Engineering (Core)',
    stack: 'node-express',
    repoUrl: 'github.com/systemwithayush/notify-svc',
    status: 'succeeded',
    replicas: '1/1',
    env: 'dev',
    lastDeployed: '2d ago',
    cpuUsage: '60m / 200m',
    memUsage: '120Mi / 256Mi'
  }
];

export default function App() {
  const [activeTab, setActiveTab] = useState<'overview' | 'services' | 'deployments' | 'terraform' | 'advisory' | 'quotas' | 'audit'>('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStack, setSelectedStack] = useState<string>('all');
  const [services, setServices] = useState<ServiceItem[]>(INITIAL_SERVICES);
  
  // Active User / Auth State
  const [currentUser, setCurrentUser] = useState<UserPersona>(PERSONAS[0]); // Default: Divya (Admin)
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [enteredPassword, setEnteredPassword] = useState('password123');
  const [authError, setAuthError] = useState('');
  const [rbacAlert, setRbacAlert] = useState<{ title: string; message: string } | null>(null);

  // Deployment state
  const [showDeployModal, setShowDeployModal] = useState(false);
  const [targetService, setTargetService] = useState<string>('auth-gateway');
  const [targetEnv, setTargetEnv] = useState<'dev' | 'staging' | 'prod'>('staging');
  const [showSecrets, setShowSecrets] = useState(false);
  const [secretRevealedToast, setSecretRevealedToast] = useState(false);
  const [syncingCluster, setSyncingCluster] = useState(false);
  const [copiedHcl, setCopiedHcl] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Scaffolding modal state
  const [showScaffoldModal, setShowScaffoldModal] = useState(false);
  const [scaffoldName, setScaffoldName] = useState('order-service');
  const [scaffoldStack, setScaffoldStack] = useState<'node-express' | 'python-fastapi' | 'react-static'>('node-express');
  const [scaffoldEnv, setScaffoldEnv] = useState<'dev' | 'staging' | 'prod'>('dev');

  // Terraform viewer state
  const [selectedTfFile, setSelectedTfFile] = useState<'main.tf' | 'variables.tf' | 'database.tf' | 'storage.tf' | 'outputs.tf'>('main.tf');
  const [selectedCloudProvider, setSelectedCloudProvider] = useState<'gcp' | 'aws'>('gcp');

  // AI Advisory state
  const [aiState, setAiState] = useState<'pending' | 'approved' | 'rejected'>('pending');

  const [logs, setLogs] = useState<string[]>([
    '2026-11-09 21:00:12 [info] Pod scheduled to node kind-worker-2',
    '2026-11-09 21:00:13 [info] Pulling image ghcr.io/systemwithayush/auth-gateway:8f3c1a2',
    '2026-11-09 21:00:15 [info] Successfully pulled image in 1.84s',
    '2026-11-09 21:00:16 [info] Container started; mounted Secret idp-env-secret (AES-256 decrypted)',
    '2026-11-09 21:00:18 [ready] Express HTTP listener online at :3000',
    '2026-11-09 21:00:20 [healthz] GET /ready HTTP/1.1 200 OK (latency: 1.4ms)',
    '2026-11-09 21:00:22 [k8s] Readiness probe 3/3 passed; traffic routing enabled'
  ]);

  const showNotification = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const filteredServices = services.filter(s => {
    const matchesSearch = s.name.toLowerCase().includes(searchQuery.toLowerCase()) || s.team.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStack = selectedStack === 'all' || s.stack === selectedStack;
    return matchesSearch && matchesStack;
  });

  const handleSwitchPersona = (persona: UserPersona) => {
    if (enteredPassword.trim() !== 'password123' && enteredPassword.trim() !== 'admin123' && enteredPassword.trim() !== 'idp123') {
      setAuthError('Invalid password. Default easy password is: password123');
      return;
    }
    setAuthError('');
    setCurrentUser(persona);
    setShowSecrets(false); // Reset secret reveal on persona switch
    setShowAuthModal(false);
    showNotification(`Switched active session to ${persona.name} (${persona.role.toUpperCase()})`);
    setLogs(prev => [
      ...prev,
      `2026-11-09 21:05:00 [auth] Session authenticated: ${persona.name} <${persona.email}> as ${persona.role.toUpperCase()}`,
    ]);
  };

  const handleTriggerDeploy = () => {
    // RBAC: If Ayush (Developer) attempts to deploy directly to prod without lead sign-off
    if (currentUser.role === 'developer' && targetEnv === 'prod') {
      setRbacAlert({
        title: 'Production Deployment Requires Approval',
        message: `Ayush is assigned the Developer role. Direct rollouts to Production require sign-off from Team Lead (Deepak) or Platform Admin (Divya). Rollout has been submitted for Lead review.`,
      });
      setShowDeployModal(false);
      setLogs(prev => [
        ...prev,
        `2026-11-09 21:05:30 [rbac-gate] Production deployment request by ${currentUser.name} staged for Lead review.`,
      ]);
      return;
    }

    setShowDeployModal(false);
    const newId = `srv-${Date.now()}`;
    setServices(prev => prev.map(s => s.name === targetService ? { ...s, status: 'building', env: targetEnv, lastDeployed: 'Just now' } : s));
    
    setLogs(prev => [
      ...prev,
      `2026-11-09 21:05:40 [idp] Triggered deployment on ${targetService} (${targetEnv}) by ${currentUser.name} (${currentUser.role})`,
      `2026-11-09 21:05:42 [ci] GitHub Actions run #192 building (correlation: ${newId})`,
      `2026-11-09 21:05:45 [registry] Image pushed to ghcr.io/systemwithayush/${targetService}:latest`,
      `2026-11-09 21:05:47 [k8s] Applying typed manifests to namespace idp-${targetService}-${targetEnv}`,
      `2026-11-09 21:05:49 [k8s] Rollout condition Succeeded: 2/2 pods healthy. Probe 200 OK.`
    ]);

    showNotification(`Rollout dispatched for ${targetService} to ${targetEnv}`);

    setTimeout(() => {
      setServices(prev => prev.map(s => s.name === targetService ? { ...s, status: 'succeeded' } : s));
    }, 3000);
  };

  const handleTriggerRollback = (serviceName: string) => {
    // Developers can only rollback dev or staging; prod requires lead/admin
    const s = services.find(item => item.name === serviceName);
    if (currentUser.role === 'developer' && s?.env === 'prod') {
      setRbacAlert({
        title: 'Production Rollback Permission Denied',
        message: `Ayush is in Developer role. Production rollback requires Team Lead (Deepak) or Platform Admin (Divya). Switch persona to proceed.`,
      });
      return;
    }

    setServices(prev => prev.map(item => item.name === serviceName ? { ...item, status: 'rolled_back', lastDeployed: 'Just now (Rollback)' } : item));
    setLogs(prev => [
      ...prev,
      `2026-11-09 21:06:10 [rollback] Manual rollback executed on ${serviceName} by ${currentUser.name} (${currentUser.role})`,
      `2026-11-09 21:06:11 [state-machine] Transition: requested -> IMAGE_PUSHED -> applying`,
      `2026-11-09 21:06:13 [k8s] Reverted to prior ReplicaSet revision rs-${serviceName}-v1`,
      `2026-11-09 21:06:15 [audit] Rollback action written to immutable audit log.`
    ]);
    showNotification(`Rollback executed for ${serviceName}`);
  };

  const handleScaffoldSubmit = () => {
    setShowScaffoldModal(false);
    const newService: ServiceItem = {
      id: `srv-${Date.now()}`,
      name: scaffoldName,
      team: currentUser.team,
      stack: scaffoldStack,
      repoUrl: `github.com/systemwithayush/${scaffoldName}`,
      status: 'succeeded',
      replicas: '1/1',
      env: scaffoldEnv,
      lastDeployed: 'Just now (Scaffolded)',
      cpuUsage: '50m / 200m',
      memUsage: '110Mi / 256Mi',
    };
    setServices(prev => [newService, ...prev]);
    setLogs(prev => [
      ...prev,
      `2026-11-09 21:06:40 [scaffold] Golden Path template ${scaffoldStack} instantiated by ${currentUser.name}`,
      `2026-11-09 21:06:41 [idp] Injected Dockerfile, k8s.yaml, deploy.yml, and generated Terraform module`,
      `2026-11-09 21:06:42 [quota] Team quota checked: 5 of max 10 services active.`
    ]);
    showNotification(`Service "${scaffoldName}" scaffolded and registered!`);
    setActiveTab('services');
  };

  const handleRevealSecrets = () => {
    // RBAC check: Ayush (Developer) cannot reveal secrets
    if (!currentUser.canRevealSecrets) {
      setRbacAlert({
        title: 'Secret Decryption Unauthorized',
        message: `Ayush is assigned Developer role. In compliance with ADR-005, only Team Lead (Deepak) and Platform Admin (Divya) have authorization to decrypt and view plaintext secrets.`,
      });
      return;
    }

    setShowSecrets(!showSecrets);
    if (!showSecrets) {
      setSecretRevealedToast(true);
      setTimeout(() => setSecretRevealedToast(false), 3500);
      setLogs(prev => [
        ...prev,
        `2026-11-09 21:07:00 [audit] REVEAL_SECRET invoked by ${currentUser.name} (${currentUser.role}). Decrypted DB_PASSWORD.`,
      ]);
    }
  };

  const handleApproveAdvisory = () => {
    if (!currentUser.canApproveAI) {
      setRbacAlert({
        title: 'Advisory Approval Restricted',
        message: `Ayush (Developer) cannot approve infrastructure capacity modifications directly. Request forwarded to Team Lead (Deepak) and Admin (Divya).`,
      });
      setLogs(prev => [
        ...prev,
        `2026-11-09 21:07:20 [ai-gate] Advisory approval requested by Ayush. Staged for Deepak/Divya sign-off.`,
      ]);
      return;
    }

    setAiState('approved');
    setServices(prev => prev.map(s => s.name === 'auth-gateway' ? { ...s, cpuUsage: '140m / 250m', memUsage: '210Mi / 256Mi' } : s));
    setLogs(prev => [
      ...prev,
      `2026-11-09 21:07:25 [ai] Advisory approved by ${currentUser.name} (${currentUser.role}). Environment sizing patched to 250m CPU / 256MiB RAM.`,
    ]);
    showNotification('AI rightsizing approved and applied to cluster manifests!');
  };

  const handleSyncCluster = () => {
    setSyncingCluster(true);
    setLogs(prev => [
      ...prev,
      `2026-11-09 21:07:40 [cluster] Sync requested by ${currentUser.name}... Polling 12 pods across 3 namespaces.`,
      `2026-11-09 21:07:41 [cluster] 100% healthy: Ingress, metrics-server, and deployments aligned.`,
    ]);
    setTimeout(() => {
      setSyncingCluster(false);
      showNotification('Cluster state synchronized with local Kind daemon.');
    }, 800);
  };

  const terraformSamples: Record<string, string> = {
    'main.tf': `resource "kubernetes_namespace" "service_ns" {
  metadata {
    name = "idp-\${var.service_name}-\${var.environment}"
    labels = {
      "app.kubernetes.io/managed-by" = "idp-platform"
      "idp.internal/service"         = var.service_name
      "idp.internal/environment"     = var.environment
      "idp.internal/operator"        = "${currentUser.name.toLowerCase()}"
    }
  }
}

resource "kubernetes_deployment" "app" {
  metadata {
    name      = var.service_name
    namespace = kubernetes_namespace.service_ns.metadata[0].name
    labels = {
      app                         = var.service_name
      env                         = var.environment
      "app.kubernetes.io/managed" = "idp-platform"
    }
  }

  spec {
    replicas = var.replicas

    selector {
      match_labels = {
        app = var.service_name
      }
    }

    template {
      metadata {
        labels = {
          app = var.service_name
          env = var.environment
        }
      }

      spec {
        container {
          name  = var.service_name
          image = "\${var.image_repo}:latest"

          port {
            name           = "http"
            container_port = 3000
          }

          resources {
            requests = {
              cpu    = "\${var.cpu_request_m}m"
              memory = "\${var.memory_request_mb}Mi"
            }
            limits = {
              cpu    = "\${var.cpu_request_m * 2}m"
              memory = "\${var.memory_request_mb * 2}Mi"
            }
          }
        }
      }
    }
  }
}`,
    'variables.tf': `variable "service_name" {
  type        = string
  description = "Unique microservice name"
  default     = "${targetService}"
}

variable "environment" {
  type        = string
  description = "Target deployment environment tier"
  default     = "${targetEnv}"
}

variable "replicas" {
  type        = number
  description = "Number of active pod replicas"
  default     = 2
}

variable "cpu_request_m" {
  type        = number
  description = "CPU allocation in millicores"
  default     = 250
}

variable "memory_request_mb" {
  type        = number
  description = "Memory allocation in megabytes"
  default     = 256
}

variable "image_repo" {
  type        = string
  description = "Container image repository URI"
  default     = "ghcr.io/systemwithayush/${targetService}"
}`,
    'database.tf': selectedCloudProvider === 'gcp' ? `resource "google_sql_database_instance" "master" {
  name             = "idp-\${var.service_name}-\${var.environment}-db"
  database_version = "MYSQL_8_0"
  region           = "us-central1"

  settings {
    tier = var.environment == "prod" ? "db-n1-standard-2" : "db-f1-micro"

    backup_configuration {
      enabled            = true
      binary_log_enabled = var.environment == "prod"
    }

    ip_configuration {
      ipv4_enabled    = false
      private_network = "projects/idp-gcp/global/networks/idp-vpc"
    }
  }
}

resource "google_sql_database" "default" {
  name     = var.service_name
  instance = google_sql_database_instance.master.name
}` : `resource "aws_db_instance" "default" {
  identifier        = "idp-\${var.service_name}-\${var.environment}-db"
  engine            = "mysql"
  engine_version    = "8.0"
  instance_class    = var.environment == "prod" ? "db.t3.medium" : "db.t3.micro"
  allocated_storage = 20
  storage_type      = "gp3"
  db_name           = var.service_name
  multi_az          = var.environment == "prod"
  skip_final_snapshot = var.environment != "prod"
}`,
    'storage.tf': selectedCloudProvider === 'gcp' ? `resource "google_storage_bucket" "assets" {
  name          = "idp-\${var.service_name}-\${var.environment}-assets"
  location      = "US"
  force_destroy = false

  uniform_bucket_level_access = true

  versioning {
    enabled = true
  }
}` : `resource "aws_s3_bucket" "assets" {
  bucket        = "idp-\${var.service_name}-\${var.environment}-assets"
  force_destroy = false
}

resource "aws_s3_bucket_versioning" "assets_versioning" {
  bucket = aws_s3_bucket.assets.id
  versioning_configuration {
    status = "Enabled"
  }
}`,
    'outputs.tf': `output "service_internal_endpoint" {
  description = "Internal Kubernetes ClusterIP endpoint"
  value       = "\${kubernetes_deployment.app.metadata[0].name}.\${kubernetes_namespace.service_ns.metadata[0].name}.svc.cluster.local"
}

output "kubernetes_namespace" {
  description = "Namespace running service workloads"
  value       = kubernetes_namespace.service_ns.metadata[0].name
}`
  };

  const handleDownloadHcl = () => {
    const element = document.createElement("a");
    const file = new Blob([terraformSamples[selectedTfFile]], { type: 'text/plain' });
    element.href = URL.createObjectURL(file);
    element.download = `${targetService}-${selectedTfFile}`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
    showNotification(`Downloaded ${targetService}-${selectedTfFile}`);
  };

  const handleCopyHcl = () => {
    navigator.clipboard.writeText(terraformSamples[selectedTfFile]);
    setCopiedHcl(true);
    setTimeout(() => setCopiedHcl(false), 2000);
    showNotification(`Copied ${selectedTfFile} to clipboard!`);
  };

  return (
    <div className="min-h-screen bg-[#0B0F17] text-slate-200 font-sans flex flex-col selection:bg-blue-600 selection:text-white">
      {/* Top Navbar */}
      <nav className="h-14 border-b border-slate-800/80 bg-[#0E131F]/90 backdrop-blur sticky top-0 z-50 px-5 flex items-center justify-between shadow-md">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2.5 font-bold tracking-tight text-white text-sm">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
              <Terminal className="w-4 h-4" />
            </div>
            <span>IDP PLATFORM</span>
            <span className="text-[11px] font-mono font-medium px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
              v1.0-release
            </span>
          </div>

          {/* Quick Breadcrumb */}
          <div className="hidden md:flex items-center gap-2 text-xs text-slate-400 border-l border-slate-800 pl-6">
            <span className="text-slate-500">Org:</span>
            <span className="text-slate-200 font-medium">SystemWithAyush</span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
            <span className="text-emerald-400 font-mono flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              kind-local (k8s v1.28)
            </span>
          </div>
        </div>

        {/* Top Action Buttons & Auth Persona Pill */}
        <div className="flex items-center gap-3 text-xs">
          <button 
            onClick={() => setShowScaffoldModal(true)}
            className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold px-3 py-1.5 rounded-lg border border-slate-700 transition-all hover:scale-[1.02]"
            title="Scaffold new service using Golden Path templates"
          >
            <Boxes className="w-3.5 h-3.5 text-indigo-400" />
            <span className="hidden sm:inline">Scaffold Service</span>
          </button>

          <button 
            onClick={() => setShowDeployModal(true)}
            className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold px-3 py-1.5 rounded-lg shadow-sm shadow-blue-600/30 transition-all hover:scale-[1.02]"
            title="Trigger container rollout to cluster"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Deploy</span>
          </button>
          
          <div className="h-4 w-px bg-slate-800"></div>

          {/* Persona / Auth Switcher Button */}
          <button 
            onClick={() => setShowAuthModal(true)}
            className="flex items-center gap-2.5 bg-slate-900/90 hover:bg-slate-800 border border-slate-700/80 rounded-xl px-3 py-1.5 transition-all shadow-sm group"
            title="Switch User Role (Divya, Deepak, Ayush)"
          >
            <div className={`w-6 h-6 rounded-lg ${currentUser.avatarBg} border flex items-center justify-center text-xs font-mono font-bold ${currentUser.avatarColor}`}>
              {currentUser.name[0]}
            </div>
            <div className="text-left leading-tight hidden sm:block">
              <div className="text-slate-200 font-bold text-xs flex items-center gap-1.5">
                <span>{currentUser.name}</span>
                <span className={`text-[9px] font-mono px-1.5 py-0.2 rounded border font-bold ${currentUser.badgeBg} ${currentUser.badgeBorder} ${currentUser.badgeText}`}>
                  {currentUser.role.toUpperCase()}
                </span>
              </div>
              <div className="text-[10px] text-slate-400 font-mono truncate max-w-[120px]">
                {currentUser.email}
              </div>
            </div>
            <UserCheck className="w-3.5 h-3.5 text-slate-500 group-hover:text-blue-400 transition-colors ml-0.5" />
          </button>
        </div>
      </nav>

      {/* Main Container with Scrollable Left Sidebar */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Option Panel (Scrollable, Sticky, and Dense) */}
        <aside className="w-64 border-r border-slate-800/80 bg-[#0B0F17] p-3 space-y-5 h-[calc(100vh-3.5rem)] sticky top-14 overflow-y-auto overflow-x-hidden select-none custom-scrollbar flex flex-col justify-between flex-shrink-0">
          <div className="space-y-5">
            <div>
              <div className="text-[10px] font-mono font-semibold uppercase tracking-wider text-slate-500 px-3 mb-2 flex items-center justify-between">
                <span>Platform Navigation</span>
                <span className="text-[9px] text-slate-600">v1.0</span>
              </div>
              <nav className="space-y-1">
                {[
                  { id: 'overview', name: 'Fleet Overview', icon: Activity },
                  { id: 'services', name: 'Service Catalogue', icon: Layers, count: services.length },
                  { id: 'deployments', name: 'Deployments & CI', icon: GitBranch, count: '39' },
                  { id: 'terraform', name: 'Terraform HCL', icon: FileCode, badge: 'Phase 7' },
                  { id: 'advisory', name: 'AI Infrastructure', icon: Sparkles, badge: 'Active' },
                  { id: 'quotas', name: 'Resource Quotas', icon: Cpu },
                  { id: 'audit', name: 'Audit Trail', icon: History },
                ].map(item => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => setActiveTab(item.id as any)}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                        isActive 
                          ? 'bg-blue-600/10 text-blue-400 font-semibold border border-blue-500/20 shadow-sm' 
                          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <Icon className={`w-4 h-4 ${isActive ? 'text-blue-400' : 'text-slate-500'}`} />
                        <span>{item.name}</span>
                      </div>
                      {item.count && (
                        <span className="text-[10px] font-mono bg-slate-800/80 px-1.5 py-0.5 rounded text-slate-400">
                          {item.count}
                        </span>
                      )}
                      {item.badge && (
                        <span className="text-[9px] font-mono bg-gradient-to-r from-blue-500 to-indigo-500 text-white px-1.5 py-0.2 rounded font-bold shadow-sm">
                          {item.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </nav>
            </div>

            {/* Active User Persona Capability Card */}
            <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-3 space-y-2.5 text-xs font-mono">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-[10px] font-bold uppercase text-slate-500">Active Permissions</span>
                <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded border ${currentUser.badgeBg} ${currentUser.badgeBorder} ${currentUser.badgeText}`}>
                  {currentUser.role}
                </span>
              </div>
              <div className="text-[11px] text-slate-300 font-bold">{currentUser.name}</div>
              <div className="space-y-1 text-[10px]">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Decrypt Secrets:</span>
                  <span className={currentUser.canRevealSecrets ? 'text-emerald-400 font-bold' : 'text-red-400'}>
                    {currentUser.canRevealSecrets ? 'ALLOWED' : 'DENIED'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Approve AI Sizing:</span>
                  <span className={currentUser.canApproveAI ? 'text-emerald-400 font-bold' : 'text-amber-400'}>
                    {currentUser.canApproveAI ? 'ALLOWED' : 'NEEDS SIGN-OFF'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Deploy Production:</span>
                  <span className={currentUser.canDeployProd ? 'text-emerald-400 font-bold' : 'text-amber-400'}>
                    {currentUser.canDeployProd ? 'ALLOWED' : 'NEEDS SIGN-OFF'}
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Health Widget */}
            <div className="bg-slate-900/40 border border-slate-800/80 rounded-xl p-3 space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400 font-medium">Cluster Health</span>
                <span className="text-emerald-400 font-mono text-[11px] font-semibold flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> 100%
                </span>
              </div>
              <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                <div className="bg-emerald-500 h-full rounded-full w-full"></div>
              </div>
              <div className="text-[10px] text-slate-500 font-mono flex justify-between">
                <span>Pods: 12/12 Online</span>
                <span>Kind-Local: Ready</span>
              </div>
            </div>
          </div>

          {/* Switch Persona Trigger in Sidebar */}
          <div className="pt-3 border-t border-slate-800/80">
            <button
              onClick={() => setShowAuthModal(true)}
              className="w-full bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 font-mono text-[11px] py-2 rounded-lg transition-all flex items-center justify-center gap-2"
            >
              <KeyRound className="w-3.5 h-3.5 text-blue-400" />
              <span>Switch Persona</span>
            </button>
          </div>
        </aside>

        {/* Main Content Pane */}
        <main className="flex-1 p-6 overflow-y-auto max-w-7xl">
          {/* Secret Revealed Toast */}
          {secretRevealedToast && (
            <div className="fixed bottom-6 right-6 bg-amber-500/10 border border-amber-500/30 text-amber-300 px-4 py-2.5 rounded-xl shadow-xl flex items-center gap-2.5 text-xs font-mono animate-fadeIn z-50">
              <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
              <span>Audit Notice: Secret reveal event recorded to immutable audit log by {currentUser.name} ({currentUser.role}).</span>
            </div>
          )}

          {/* Generic Toast Message */}
          {toastMessage && (
            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-blue-600/95 text-white px-4 py-2 rounded-xl shadow-2xl flex items-center gap-2 text-xs font-mono animate-fadeIn z-50 border border-blue-400">
              <Check className="w-4 h-4 text-white" />
              <span>{toastMessage}</span>
            </div>
          )}

          {/* RBAC Access Denied Modal / Alert */}
          {rbacAlert && (
            <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-50 p-4">
              <div className="bg-[#111622] border border-red-500/40 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
                <div className="flex items-center gap-3 text-red-400">
                  <div className="w-10 h-10 rounded-xl bg-red-950/60 border border-red-800/80 flex items-center justify-center">
                    <ShieldAlert className="w-5 h-5 text-red-400" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-sm">{rbacAlert.title}</h3>
                    <span className="text-[10px] font-mono text-red-400 uppercase">Role-Based Access Control (RBAC)</span>
                  </div>
                </div>

                <p className="text-xs text-slate-300 font-mono leading-relaxed bg-slate-950 p-3 rounded-lg border border-slate-800">
                  {rbacAlert.message}
                </p>

                <div className="flex justify-end gap-2 pt-2">
                  <button 
                    onClick={() => {
                      setRbacAlert(null);
                      setShowAuthModal(true);
                    }}
                    className="px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-mono font-bold"
                  >
                    Switch to Lead/Admin
                  </button>
                  <button 
                    onClick={() => setRbacAlert(null)}
                    className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-mono"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 1: FLEET OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-6 animate-fadeIn">
              {/* Header Banner */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
                <div>
                  <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
                    <span>Internal Developer Platform</span>
                    <span className="text-xs font-mono text-slate-400 bg-slate-800 px-2 py-0.5 rounded font-normal">
                      Operator: {currentUser.name} ({currentUser.role})
                    </span>
                  </h1>
                  <p className="text-xs text-slate-400 mt-1">
                    Multi-tenant GitOps orchestrator with Golden Path templates, AES-256 secret vault, and grounded AI optimization.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={handleSyncCluster}
                    disabled={syncingCluster}
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs px-3.5 py-2 rounded-lg transition-all shadow disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${syncingCluster ? 'animate-spin' : ''}`} />
                    <span>{syncingCluster ? 'Syncing...' : 'Sync Cluster State'}</span>
                  </button>
                </div>
              </div>

              {/* Metric Cards Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { label: 'Active Services', value: `${services.length}`, change: '+2 this week', icon: Layers, color: 'text-blue-400' },
                  { label: 'Deployments (24h)', value: '39', change: '99.4% success', icon: GitBranch, color: 'text-indigo-400' },
                  { label: 'CPU Allocation', value: '460m / 4,000m', change: '11.5% team quota', icon: Cpu, color: 'text-emerald-400' },
                  { label: 'Memory Allocation', value: '832 MiB / 8 GiB', change: '10.1% team quota', icon: ShieldCheck, color: 'text-amber-400' },
                ].map((stat, i) => {
                  const Icon = stat.icon;
                  return (
                    <div key={i} className="bg-[#111622] border border-slate-800 rounded-xl p-4 space-y-3">
                      <div className="flex items-center justify-between text-slate-400">
                        <span className="text-xs font-medium">{stat.label}</span>
                        <Icon className={`w-4 h-4 ${stat.color}`} />
                      </div>
                      <div className="text-2xl font-bold font-mono text-white">{stat.value}</div>
                      <div className="text-[11px] font-mono text-slate-500">{stat.change}</div>
                    </div>
                  );
                })}
              </div>

              {/* Service Quick-View Table */}
              <div className="bg-[#111622] border border-slate-800 rounded-xl overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
                  <div className="font-semibold text-sm text-white flex items-center gap-2">
                    <Boxes className="w-4 h-4 text-blue-400" />
                    <span>Production Services</span>
                  </div>
                  <button 
                    onClick={() => setActiveTab('services')}
                    className="text-xs text-blue-400 hover:text-blue-300 font-mono flex items-center gap-1"
                  >
                    <span>View all services</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>

                <div className="divide-y divide-slate-800/80 font-mono text-xs">
                  {services.map(s => (
                    <div key={s.id} className="p-4 flex items-center justify-between hover:bg-slate-900/40 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className={`w-2.5 h-2.5 rounded-full ${s.status === 'succeeded' ? 'bg-emerald-400' : s.status === 'rolled_back' ? 'bg-amber-400' : 'bg-blue-400 animate-ping'}`}></div>
                        <div>
                          <div className="font-bold text-white text-sm flex items-center gap-2">
                            {s.name}
                            <span className="text-[10px] font-normal px-2 py-0.5 rounded bg-slate-800 text-slate-400">
                              {s.stack}
                            </span>
                          </div>
                          <div className="text-slate-500 text-[11px] mt-0.5">{s.repoUrl}</div>
                        </div>
                      </div>

                      <div className="flex items-center gap-6">
                        <div className="text-right hidden sm:block">
                          <div className="text-slate-300">{s.cpuUsage}</div>
                          <div className="text-[10px] text-slate-500">CPU Usage</div>
                        </div>
                        <div className="text-right hidden sm:block">
                          <div className="text-slate-300">{s.memUsage}</div>
                          <div className="text-[10px] text-slate-500">RAM Usage</div>
                        </div>
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wider ${
                          s.status === 'succeeded' 
                            ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' 
                            : s.status === 'rolled_back'
                            ? 'bg-amber-950 text-amber-400 border border-amber-800'
                            : 'bg-blue-950 text-blue-400 border border-blue-800'
                        }`}>
                          {s.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: SERVICE CATALOGUE */}
          {activeTab === 'services' && (
            <div className="space-y-5 animate-fadeIn">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
                <div>
                  <h1 className="text-xl font-bold text-white tracking-tight">Registered Microservices</h1>
                  <p className="text-xs text-slate-400 mt-1">
                    Manage service definitions, Kubernetes configurations, and AES-256 encrypted environment variables.
                  </p>
                </div>
                <div className="flex items-center gap-2.5">
                  <button 
                    onClick={() => setShowScaffoldModal(true)}
                    className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs px-3.5 py-2 rounded-lg transition-all"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Scaffold Service</span>
                  </button>
                  <button 
                    onClick={handleRevealSecrets}
                    className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-mono text-xs px-3 py-2 rounded-lg border border-slate-700 transition-all"
                    title={currentUser.canRevealSecrets ? 'Decrypt secrets' : 'Requires Lead or Admin'}
                  >
                    {showSecrets ? <EyeOff className="w-3.5 h-3.5 text-amber-400" /> : <Eye className="w-3.5 h-3.5 text-slate-400" />}
                    <span>{showSecrets ? 'Mask Secrets' : 'Reveal Secrets'}</span>
                  </button>
                </div>
              </div>

              {/* Filters & Search */}
              <div className="flex flex-wrap items-center justify-between gap-3 bg-[#111622] p-3 rounded-xl border border-slate-800 text-xs">
                <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 w-72">
                  <Search className="w-3.5 h-3.5 text-slate-500" />
                  <input 
                    type="text" 
                    placeholder="Search services, teams..." 
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="bg-transparent border-none text-slate-200 focus:outline-none w-full"
                  />
                </div>

                <div className="flex items-center gap-2 font-mono">
                  <span className="text-slate-500">Stack:</span>
                  {(['all', 'node-express', 'python-fastapi', 'react-static'] as const).map(stack => (
                    <button
                      key={stack}
                      onClick={() => setSelectedStack(stack)}
                      className={`px-2.5 py-1 rounded-md transition-all ${
                        selectedStack === stack ? 'bg-blue-600 text-white font-semibold' : 'bg-slate-900 text-slate-400 hover:text-white'
                      }`}
                    >
                      {stack}
                    </button>
                  ))}
                </div>
              </div>

              {/* Services Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredServices.map(s => (
                  <div key={s.id} className="bg-[#111622] border border-slate-800 rounded-xl p-5 space-y-4 hover:border-slate-700 transition-all">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-white text-base">{s.name}</h3>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-blue-400 border border-blue-500/20">
                            {s.stack}
                          </span>
                        </div>
                        <div className="text-slate-500 text-xs font-mono mt-1">{s.team}</div>
                      </div>

                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono uppercase font-semibold ${
                        s.status === 'succeeded' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-blue-950 text-blue-400 border border-blue-800'
                      }`}>
                        {s.status}
                      </span>
                    </div>

                    {/* Sizing & K8s Specs */}
                    <div className="grid grid-cols-3 gap-2 bg-slate-950/70 p-3 rounded-lg border border-slate-800/80 text-xs font-mono">
                      <div>
                        <div className="text-slate-500 text-[10px]">REPLICAS</div>
                        <div className="text-slate-200 font-semibold">{s.replicas}</div>
                      </div>
                      <div>
                        <div className="text-slate-500 text-[10px]">CPU ALLOC</div>
                        <div className="text-slate-200 font-semibold">{s.cpuUsage.split('/')[1]?.trim() || '500m'}</div>
                      </div>
                      <div>
                        <div className="text-slate-500 text-[10px]">MEM ALLOC</div>
                        <div className="text-slate-200 font-semibold">{s.memUsage.split('/')[1]?.trim() || '512Mi'}</div>
                      </div>
                    </div>

                    {/* Environment Variables & Secrets Vault */}
                    <div className="space-y-1.5 text-xs font-mono">
                      <div className="text-slate-400 text-[11px] font-semibold flex items-center justify-between">
                        <span>ConfigMap & Secret Keys</span>
                        <span className="text-[10px] text-slate-500">Namespace: idp-{s.name}-{s.env}</span>
                      </div>
                      <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800/80 space-y-1 text-[11px]">
                        <div className="flex justify-between text-slate-400">
                          <span>NODE_ENV:</span>
                          <span className="text-emerald-400 font-bold">{s.env}</span>
                        </div>
                        <div className="flex justify-between text-slate-400">
                          <span>PORT:</span>
                          <span className="text-slate-200">3000</span>
                        </div>
                        <div className="flex justify-between text-slate-400">
                          <span>DB_PASSWORD:</span>
                          <span className={showSecrets ? 'text-amber-400 font-mono font-bold' : 'text-slate-500'}>
                            {showSecrets ? 's3cret_P@ssw0rd!_decrypted' : '••••••••••••••••'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 text-xs font-mono">
                      <span className="text-slate-500">Last rollout: {s.lastDeployed}</span>
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => handleTriggerRollback(s.name)}
                          className="flex items-center gap-1 text-amber-400 hover:text-amber-300 font-semibold px-2 py-1 rounded hover:bg-amber-950/30 transition-all text-[11px]"
                          title="Rollback to prior ReplicaSet"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>Rollback</span>
                        </button>
                        <button 
                          onClick={() => {
                            setTargetService(s.name);
                            setShowDeployModal(true);
                          }}
                          className="text-blue-400 hover:text-blue-300 font-semibold flex items-center gap-1"
                        >
                          <span>Deploy</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: DEPLOYMENTS & LIVE LOGS */}
          {activeTab === 'deployments' && (
            <div className="space-y-6 animate-fadeIn">
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <div>
                  <h1 className="text-xl font-bold text-white tracking-tight">Deployments & Kubernetes Rollout</h1>
                  <p className="text-xs text-slate-400 mt-1">
                    Deterministic state machine execution with live container log streaming and automatic rollback.
                  </p>
                </div>
                <button 
                  onClick={() => setShowDeployModal(true)}
                  className="bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs px-3.5 py-2 rounded-lg flex items-center gap-1.5 shadow"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>New Rollout</span>
                </button>
              </div>

              {/* State Machine Visualization */}
              <div className="bg-[#111622] border border-slate-800 rounded-xl p-5 space-y-3">
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider font-mono">
                  Deployment State Machine Flow
                </div>
                <div className="grid grid-cols-2 md:grid-cols-6 gap-2 text-center text-xs font-mono">
                  {[
                    { state: 'requested', color: 'bg-slate-900 border-slate-800 text-slate-400' },
                    { state: 'building', color: 'bg-blue-950/60 border-blue-800 text-blue-400' },
                    { state: 'pushed', color: 'bg-indigo-950/60 border-indigo-800 text-indigo-400' },
                    { state: 'applying', color: 'bg-purple-950/60 border-purple-800 text-purple-400' },
                    { state: 'rolling_out', color: 'bg-amber-950/60 border-amber-800 text-amber-400' },
                    { state: 'succeeded', color: 'bg-emerald-950 border-emerald-700 text-emerald-400 font-bold' },
                  ].map((s, idx) => (
                    <div key={s.state} className={`p-2.5 rounded-lg border ${s.color}`}>
                      <div className="text-[10px] text-slate-500">Step {idx + 1}</div>
                      <div>{s.state}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Live Pod Logs Console */}
              <div className="bg-[#0D1117] border border-slate-800 rounded-xl overflow-hidden shadow-2xl">
                <div className="bg-slate-900/90 px-4 py-2.5 border-b border-slate-800 flex items-center justify-between font-mono text-xs">
                  <div className="flex items-center gap-2">
                    <Terminal className="w-4 h-4 text-emerald-400" />
                    <span className="text-white font-bold">Pod Live Logs</span>
                    <span className="text-slate-500">|</span>
                    <span className="text-slate-400">auth-gateway-7b9c6f8-qk29r</span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-slate-400">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                    <span>Streaming (Socket.io)</span>
                    <button 
                      onClick={() => setLogs(['-- Logs reset by operator --'])}
                      className="ml-2 text-slate-500 hover:text-slate-300"
                      title="Clear console"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="p-4 font-mono text-xs text-slate-300 space-y-1.5 h-64 overflow-y-auto bg-black/60">
                  {logs.map((log, index) => (
                    <div key={index} className="flex gap-2">
                      <span className="text-slate-600 select-none">[{index + 1}]</span>
                      <span className={log.includes('rollback') ? 'text-amber-400' : log.includes('error') ? 'text-red-400' : log.includes('k8s') || log.includes('ready') ? 'text-emerald-400' : 'text-slate-300'}>
                        {log}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: TERRAFORM HCL GENERATOR (Phase 7) */}
          {activeTab === 'terraform' && (
            <div className="space-y-6 animate-fadeIn">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
                <div>
                  <h1 className="text-xl font-bold text-white tracking-tight">Terraform Infrastructure Modules</h1>
                  <p className="text-xs text-slate-400 mt-1">
                    Production-grade multi-file HCL generators for Kubernetes workloads, managed Cloud SQL, and Object Storage.
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg p-1 text-xs font-mono">
                    <button 
                      onClick={() => {
                        setSelectedCloudProvider('gcp');
                        showNotification('Switched provider to Google Cloud Platform');
                      }}
                      className={`px-3 py-1 rounded-md transition-all ${selectedCloudProvider === 'gcp' ? 'bg-blue-600 text-white font-bold' : 'text-slate-400'}`}
                    >
                      GCP
                    </button>
                    <button 
                      onClick={() => {
                        setSelectedCloudProvider('aws');
                        showNotification('Switched provider to Amazon Web Services');
                      }}
                      className={`px-3 py-1 rounded-md transition-all ${selectedCloudProvider === 'aws' ? 'bg-amber-600 text-white font-bold' : 'text-slate-400'}`}
                    >
                      AWS
                    </button>
                  </div>
                  <button 
                    onClick={handleCopyHcl}
                    className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono px-3 py-2 rounded-lg border border-slate-700 transition-all"
                  >
                    {copiedHcl ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
                    <span>{copiedHcl ? 'Copied' : 'Copy'}</span>
                  </button>
                  <button 
                    onClick={handleDownloadHcl}
                    className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold px-3.5 py-2 rounded-lg transition-all shadow-sm"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download {selectedTfFile}</span>
                  </button>
                </div>
              </div>

              {/* File Selector Tabs */}
              <div className="flex items-center gap-2 border-b border-slate-800 pb-2 text-xs font-mono">
                {(['main.tf', 'variables.tf', 'database.tf', 'storage.tf', 'outputs.tf'] as const).map(file => (
                  <button
                    key={file}
                    onClick={() => setSelectedTfFile(file)}
                    className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                      selectedTfFile === file 
                        ? 'bg-blue-600/20 text-blue-400 font-bold border border-blue-500/30' 
                        : 'text-slate-400 hover:text-white hover:bg-slate-900'
                    }`}
                  >
                    <FileCode className="w-3.5 h-3.5" />
                    <span>{file}</span>
                  </button>
                ))}
              </div>

              {/* Code Display Area */}
              <div className="bg-[#0D1117] border border-slate-800 rounded-xl overflow-hidden shadow-2xl">
                <div className="bg-slate-900/90 px-4 py-2.5 border-b border-slate-800 flex items-center justify-between font-mono text-xs">
                  <div className="flex items-center gap-2 text-slate-300">
                    <Server className="w-4 h-4 text-blue-400" />
                    <span className="font-bold text-white">{selectedTfFile}</span>
                    <span className="text-slate-500">|</span>
                    <span className="text-slate-400">Target Provider: {selectedCloudProvider.toUpperCase()}</span>
                  </div>
                  <span className="text-[10px] text-emerald-400 font-mono bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/80">
                    Syntax Validated: 0 Errors
                  </span>
                </div>

                <pre className="p-4 font-mono text-xs text-blue-200 overflow-x-auto bg-black/60 leading-relaxed">
                  {terraformSamples[selectedTfFile]}
                </pre>
              </div>
            </div>
          )}

          {/* TAB 5: AI INFRASTRUCTURE ADVISORY */}
          {activeTab === 'advisory' && (
            <div className="space-y-6 animate-fadeIn">
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <div>
                  <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-blue-400" />
                    AI Infrastructure Recommendations
                  </h1>
                  <p className="text-xs text-slate-400 mt-1">
                    Grounded optimization analyzing 7-day P95 Prometheus metrics, validating quota constraints, and generating reviewable diffs.
                  </p>
                </div>
              </div>

              {/* Active Recommendation Card */}
              <div className="bg-[#111622] border border-blue-500/30 rounded-2xl p-6 space-y-5 shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 bg-blue-600/10 text-blue-400 font-mono text-[10px] uppercase font-bold px-3 py-1 rounded-bl-lg border-b border-l border-blue-500/20">
                  Target Service: auth-gateway (Production)
                </div>

                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
                    <Cpu className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">Recommended Sizing Rightsizing: -50% Cost Savings</h3>
                    <p className="text-xs text-slate-400 font-mono">Status: {aiState.toUpperCase()}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
                  <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-800 space-y-2">
                    <div className="text-slate-500 uppercase font-bold text-[10px]">Current Resource Requests</div>
                    <div className="flex justify-between text-slate-300"><span>CPU Request:</span><span>500m</span></div>
                    <div className="flex justify-between text-slate-300"><span>Memory Request:</span><span>512 MiB</span></div>
                    <div className="flex justify-between text-slate-300"><span>Replicas:</span><span>2</span></div>
                  </div>

                  <div className="bg-blue-950/20 p-4 rounded-xl border border-blue-500/30 space-y-2">
                    <div className="text-blue-400 uppercase font-bold text-[10px]">AI Advisory (Confidence: 0.94)</div>
                    <div className="flex justify-between text-emerald-400 font-semibold"><span>Recommended CPU:</span><span>250m (-50% cost)</span></div>
                    <div className="flex justify-between text-emerald-400 font-semibold"><span>Recommended Mem:</span><span>256 MiB (-50%)</span></div>
                    <div className="flex justify-between text-blue-300 font-semibold"><span>Recommended Replicas:</span><span>2</span></div>
                  </div>
                </div>

                <div className="text-xs text-slate-300 bg-slate-900/60 p-3.5 rounded-lg border border-slate-800 space-y-1">
                  <strong className="text-white">Model Reasoning:</strong>
                  <ul className="list-disc list-inside text-slate-400 space-y-0.5 text-xs">
                    <li>P95 CPU utilization over 7 days never exceeded 140m across all replicas.</li>
                    <li>Halving CPU and Memory request safely preserves 1.8x headroom while freeing 250m team quota.</li>
                  </ul>
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button 
                    disabled={aiState !== 'pending'}
                    onClick={() => {
                      setAiState('rejected');
                      setLogs(prev => [...prev, `2026-11-09 21:08:10 [ai] Recommendation rejected by ${currentUser.name}. Preserving current sizing.`]);
                      showNotification('Recommendation rejected.');
                    }}
                    className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold px-4 py-2 rounded-lg text-xs transition-all disabled:opacity-40"
                  >
                    Reject
                  </button>

                  <button 
                    disabled={aiState !== 'pending'}
                    onClick={handleApproveAdvisory}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold px-4 py-2 rounded-lg text-xs shadow transition-all disabled:opacity-50 flex items-center gap-1.5"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>{aiState === 'approved' ? 'Approved & Applied' : 'Approve & Apply to Next Deploy'}</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 6: RESOURCE QUOTAS */}
          {activeTab === 'quotas' && (
            <div className="space-y-6 animate-fadeIn">
              <div className="border-b border-slate-800 pb-4">
                <h1 className="text-xl font-bold text-white">Team Resource Quotas</h1>
                <p className="text-xs text-slate-400 mt-1">
                  Hierarchical quotas enforced during service creation and environment resizing to prevent cluster saturation.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-[#111622] border border-slate-800 rounded-xl p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white text-sm">Platform Engineering (Core)</span>
                    <span className="text-[10px] font-mono bg-purple-500/10 text-purple-400 px-2 py-0.5 rounded border border-purple-500/20">
                      Divya (Lead/Admin)
                    </span>
                  </div>
                  <div className="space-y-3 font-mono text-xs">
                    <div>
                      <div className="flex justify-between text-slate-400 mb-1">
                        <span>Services:</span>
                        <span className="text-white font-bold">2 / 10 Active</span>
                      </div>
                      <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden">
                        <div className="bg-blue-500 h-full w-[20%]"></div>
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-slate-400 mb-1">
                        <span>CPU Millicores:</span>
                        <span className="text-white font-bold">700m / 4,000m</span>
                      </div>
                      <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden">
                        <div className="bg-emerald-500 h-full w-[17.5%]"></div>
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-slate-400 mb-1">
                        <span>Memory Allocation:</span>
                        <span className="text-white font-bold">768 MiB / 8,192 MiB</span>
                      </div>
                      <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden">
                        <div className="bg-emerald-500 h-full w-[9.3%]"></div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-[#111622] border border-slate-800 rounded-xl p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white text-sm">Payments & Core Services</span>
                    <span className="text-[10px] font-mono bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded border border-blue-500/20">
                      Deepak & Ayush
                    </span>
                  </div>
                  <div className="space-y-3 font-mono text-xs">
                    <div>
                      <div className="flex justify-between text-slate-400 mb-1">
                        <span>Services:</span>
                        <span className="text-white font-bold">2 / 8 Active</span>
                      </div>
                      <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden">
                        <div className="bg-purple-500 h-full w-[25%]"></div>
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-slate-400 mb-1">
                        <span>CPU Millicores:</span>
                        <span className="text-white font-bold">600m / 3,000m</span>
                      </div>
                      <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden">
                        <div className="bg-emerald-500 h-full w-[20%]"></div>
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-slate-400 mb-1">
                        <span>Memory Allocation:</span>
                        <span className="text-white font-bold">768 MiB / 6,144 MiB</span>
                      </div>
                      <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden">
                        <div className="bg-emerald-500 h-full w-[12.5%]"></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 7: IMMUTABLE AUDIT TRAIL */}
          {activeTab === 'audit' && (
            <div className="space-y-6 animate-fadeIn">
              <div className="border-b border-slate-800 pb-4">
                <h1 className="text-xl font-bold text-white">Immutable Audit Log</h1>
                <p className="text-xs text-slate-400 mt-1">
                  Complete audit trail recorded for all mutations, secret reveals, and automated rollbacks across Divya, Deepak, and Ayush.
                </p>
              </div>

              <div className="bg-[#111622] border border-slate-800 rounded-xl p-4 divide-y divide-slate-800/80 text-xs font-mono">
                {[
                  { time: '21:07:00', user: 'divya@idp.internal (Admin)', action: 'REVEAL_SECRET', entity: 'auth-gateway-env', status: 'AUDITED' },
                  { time: '21:06:40', user: 'ayush@idp.internal (Dev)', action: 'SERVICE_SCAFFOLDED', entity: 'order-service', status: 'SUCCESS' },
                  { time: '21:06:10', user: 'deepak@idp.internal (Lead)', action: 'MANUAL_ROLLBACK', entity: 'payment-processor', status: 'SUCCESS' },
                  { time: '21:05:40', user: 'divya@idp.internal (Admin)', action: 'DEPLOY_SERVICE', entity: 'auth-gateway:prod', status: 'SUCCESS' },
                  { time: '20:50:12', user: 'deepak@idp.internal (Lead)', action: 'APPROVE_AI_ADVISORY', entity: 'auth-gateway', status: 'SUCCESS' },
                ].map((log, i) => (
                  <div key={i} className="py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-slate-500">{log.time}</span>
                      <span className="text-slate-200">{log.user}</span>
                      <span className="text-blue-400 font-bold">{log.action}</span>
                      <span className="text-slate-400">{log.entity}</span>
                    </div>
                    <span className="text-emerald-400 bg-emerald-950 px-2 py-0.5 rounded border border-emerald-800/80 text-[10px]">
                      {log.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </main>
      </div>

      {/* AUTH & PERSONA SWITCHER MODAL */}
      {showAuthModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#111622] border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
                  <KeyRound className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">Authentication & Role Assignment</h3>
                  <p className="text-[11px] text-slate-400 font-mono">Select persona to switch active RBAC credentials</p>
                </div>
              </div>
              <button onClick={() => setShowAuthModal(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            {/* Persona Selection Cards */}
            <div className="space-y-2.5">
              <label className="text-xs font-mono text-slate-400">Select Persona Account:</label>
              <div className="space-y-2">
                {PERSONAS.map(p => {
                  const isSelected = currentUser.id === p.id;
                  return (
                    <div
                      key={p.id}
                      onClick={() => handleSwitchPersona(p)}
                      className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                        isSelected 
                          ? 'bg-slate-900 border-blue-500 ring-1 ring-blue-500/50 shadow-md' 
                          : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-lg ${p.avatarBg} border flex items-center justify-center font-mono font-bold ${p.avatarColor}`}>
                            {p.name[0]}
                          </div>
                          <div>
                            <div className="font-bold text-white text-sm flex items-center gap-2">
                              <span>{p.name}</span>
                              <span className={`text-[10px] font-mono px-2 py-0.5 rounded border font-bold ${p.badgeBg} ${p.badgeBorder} ${p.badgeText}`}>
                                {p.role.toUpperCase()}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-400 font-mono">{p.email} • {p.team}</div>
                          </div>
                        </div>

                        {isSelected ? (
                          <span className="text-[11px] font-mono text-emerald-400 font-bold flex items-center gap-1">
                            <Check className="w-3.5 h-3.5" /> ACTIVE
                          </span>
                        ) : (
                          <span className="text-[11px] font-mono text-blue-400 font-semibold hover:underline">
                            Switch $\to$
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400 mt-2 font-mono border-t border-slate-800/80 pt-1.5">
                        {p.description}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Password input & notice */}
            <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-2 text-xs font-mono">
              <div className="flex items-center justify-between text-slate-300">
                <span className="flex items-center gap-1.5 font-bold">
                  <Lock className="w-3.5 h-3.5 text-blue-400" />
                  Credentials Secret
                </span>
                <span className="text-[10px] text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/80">
                  Easy Password: password123
                </span>
              </div>
              <div>
                <input 
                  type="password"
                  value={enteredPassword}
                  onChange={e => setEnteredPassword(e.target.value)}
                  placeholder="Enter password..."
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-white text-xs font-mono"
                />
              </div>
              {authError && (
                <div className="text-red-400 text-[11px] font-bold">{authError}</div>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button 
                onClick={() => setShowAuthModal(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-mono"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Deployment Modal */}
      {showDeployModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#111622] border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-white text-base flex items-center gap-2">
                <GitBranch className="w-4 h-4 text-blue-500" />
                Trigger Microservice Rollout
              </h3>
              <button onClick={() => setShowDeployModal(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <div className="space-y-4 text-xs font-mono">
              <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 text-slate-300 flex items-center justify-between">
                <span>Deploying as: <strong className="text-white">{currentUser.name}</strong></span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded border ${currentUser.badgeBg} ${currentUser.badgeBorder} ${currentUser.badgeText}`}>
                  {currentUser.role.toUpperCase()}
                </span>
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Target Service</label>
                <select 
                  value={targetService}
                  onChange={e => setTargetService(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-white"
                >
                  {services.map(s => <option key={s.id} value={s.name}>{s.name} ({s.stack})</option>)}
                </select>
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Target Environment</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['dev', 'staging', 'prod'] as const).map(env => (
                    <button
                      key={env}
                      type="button"
                      onClick={() => setTargetEnv(env)}
                      className={`p-2 rounded-lg border font-bold text-center transition-all ${
                        targetEnv === env ? 'bg-blue-600 text-white border-blue-500 shadow' : 'bg-slate-900 text-slate-400 border-slate-800'
                      }`}
                    >
                      {env}
                    </button>
                  ))}
                </div>
              </div>

              {currentUser.role === 'developer' && targetEnv === 'prod' && (
                <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg text-amber-300 text-[11px] space-y-1">
                  <div className="font-bold flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>Role Notice (Ayush):</span>
                  </div>
                  <div>Deploying to Production as Developer will submit an approval request to Deepak (Lead) and Divya (Admin).</div>
                </div>
              )}

              <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 text-slate-400 space-y-1">
                <div>Git Commit: <strong className="text-slate-200">main (HEAD)</strong></div>
                <div>Trigger Method: <strong className="text-blue-400">workflow_dispatch with correlation_id</strong></div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button 
                onClick={() => setShowDeployModal(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-mono"
              >
                Cancel
              </button>
              <button 
                onClick={handleTriggerDeploy}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold font-mono shadow-lg shadow-blue-600/30"
              >
                Execute Rollout
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Golden Path Scaffolding Modal (Phase 7) */}
      {showScaffoldModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#111622] border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-white text-base flex items-center gap-2">
                <Boxes className="w-4 h-4 text-indigo-400" />
                Scaffold New Golden Path Service
              </h3>
              <button onClick={() => setShowScaffoldModal(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <div className="space-y-4 text-xs font-mono">
              <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 text-slate-300 flex items-center justify-between">
                <span>Created by: <strong className="text-white">{currentUser.name}</strong> ({currentUser.role})</span>
                <span className="text-slate-400">{currentUser.team}</span>
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Select Golden Path Template</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'node-express', name: 'Node.js', desc: 'Express + TS' },
                    { id: 'python-fastapi', name: 'Python', desc: 'FastAPI' },
                    { id: 'react-static', name: 'React', desc: 'Vite Static' },
                  ].map(t => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setScaffoldStack(t.id as any)}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        scaffoldStack === t.id 
                          ? 'bg-indigo-600/20 border-indigo-500 text-white font-bold' 
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      <div className="text-xs">{t.name}</div>
                      <div className="text-[10px] text-slate-500">{t.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Service Name (k8s slug)</label>
                <input 
                  type="text" 
                  value={scaffoldName}
                  onChange={e => setScaffoldName(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-white"
                  placeholder="e.g. inventory-service"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Initial Environment</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['dev', 'staging', 'prod'] as const).map(env => (
                    <button
                      key={env}
                      type="button"
                      onClick={() => setScaffoldEnv(env)}
                      className={`p-2 rounded-lg border font-bold text-center ${
                        scaffoldEnv === env ? 'bg-indigo-600 text-white border-indigo-500' : 'bg-slate-900 text-slate-400 border-slate-800'
                      }`}
                    >
                      {env}
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 text-slate-400 space-y-1 text-[11px]">
                <div className="text-slate-200 font-bold mb-1">Generated Files & Manifests:</div>
                <div>✔ Dockerfile (multi-stage non-root container)</div>
                <div>✔ k8s.yaml (Deployment + ClusterIP Service)</div>
                <div>✔ .github/workflows/deploy.yml (GitHub Actions pipeline)</div>
                <div>✔ infrastructure.tf (Terraform module)</div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button 
                onClick={() => setShowScaffoldModal(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-mono"
              >
                Cancel
              </button>
              <button 
                onClick={handleScaffoldSubmit}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold font-mono shadow-lg shadow-indigo-600/30"
              >
                Scaffold & Register
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
