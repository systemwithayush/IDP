@echo off
setlocal enabledelayedexpansion

echo ==========================================
echo  Starting IDP Kind Kubernetes Cluster (Win)
echo ==========================================

where kind >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] kind is required but not installed or not in PATH.
    exit /b 1
)

where kubectl >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] kubectl is required but not installed or not in PATH.
    exit /b 1
)

set CLUSTER_NAME=idp-cluster

kind get clusters | findstr /R /C:"^%CLUSTER_NAME%$" >nul 2>nul
if %errorlevel% equ 0 (
    echo Cluster '%CLUSTER_NAME%' already exists. Skipping creation.
) else (
    echo Creating kind cluster '%CLUSTER_NAME%'...
    kind create cluster --config "%~dp0kind-config.yaml"
)

echo Setting kubectl context to kind-%CLUSTER_NAME%...
kubectl config use-context kind-%CLUSTER_NAME%

echo Creating namespaces...
kubectl create namespace idp-system --dry-run=client -o yaml | kubectl apply -f -
kubectl create namespace idp-workloads --dry-run=client -o yaml | kubectl apply -f -

echo Applying IDP deployer RBAC...
kubectl apply -f "%~dp0k8s\rbac.yaml"

echo Deploying metrics-server for AI resource advisory...
kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml
kubectl patch deployment metrics-server -n kube-system --type="json" -p="[{\"op\":\"add\",\"path\":\"/spec/template/spec/containers/0/args/-\",\"value\":\"--kubelet-insecure-tls\"}]"

echo Deploying Ingress NGINX controller for Kind...
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/main/deploy/static/provider/kind/deploy.yaml

echo ==========================================
echo  Kind cluster initialized successfully!
echo  Context: kind-%CLUSTER_NAME%
echo ==========================================
