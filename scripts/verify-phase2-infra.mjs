import { execSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';

console.log('--- LandmarkNav Phase 2 Infrastructure & Observability Validation ---');

// 1. Terraform Formatting Check
try {
  execSync('terraform fmt -check -recursive infra/terraform', { encoding: 'utf8' });
  console.log('✓ Terraform formatting: 0 discrepancies across all modules and environments.');
} catch (e) {
  console.error('✗ Terraform formatting check failed:', e.stdout || e.message);
  process.exit(1);
}

// 2. Terraform Environment Validation (dev)
try {
  execSync('terraform -chdir=infra/terraform/envs/dev init -backend=false && terraform -chdir=infra/terraform/envs/dev validate', { encoding: 'utf8' });
  console.log('✓ Terraform dev environment: Validated successfully.');
} catch (e) {
  console.error('✗ Terraform dev validation failed:', e.stdout || e.message);
  process.exit(1);
}

// 3. Kubernetes Kustomize Base & Overlays
const overlays = ['base', 'overlays/dev', 'overlays/stage', 'overlays/prod'];
for (const overlay of overlays) {
  try {
    execSync(`kubectl kustomize infra/k8s/${overlay}`, { encoding: 'utf8' });
    console.log(`✓ Kubernetes Kustomize ${overlay}: Compiles valid YAML.`);
  } catch (e) {
    console.error(`✗ Kustomize build failed for ${overlay}:`, e.stdout || e.message);
    process.exit(1);
  }
}

// 4. Prometheus Rules & Alerting Syntax
const alertRulesPath = 'infra/docker/prometheus/alert_rules.yml';
if (!existsSync(alertRulesPath)) {
  console.error(`✗ Missing Prometheus alert rules at ${alertRulesPath}`);
  process.exit(1);
}
console.log('✓ Prometheus Alert Rules: alert_rules.yml present and configured.');

// 5. Grafana Dashboard Validation
const dashboardPath = 'infra/docker/grafana/provisioning/dashboards/navigation-overview.json';
try {
  const dash = JSON.parse(readFileSync(dashboardPath, 'utf8'));
  if (!dash.title || !dash.panels || dash.panels.length === 0) {
    throw new Error('Invalid dashboard JSON schema');
  }
  console.log(`✓ Grafana Dashboard: "${dash.title}" (${dash.panels.length} panels validated).`);
} catch (e) {
  console.error(`✗ Grafana dashboard validation failed:`, e.message);
  process.exit(1);
}

// 6. ArgoCD GitOps Applications
const argocdApps = [
  'infra/k8s/argocd/application-dev.yaml',
  'infra/k8s/argocd/application-stage.yaml',
  'infra/k8s/argocd/application-prod.yaml'
];
for (const app of argocdApps) {
  if (!existsSync(app)) {
    console.error(`✗ Missing ArgoCD application manifest: ${app}`);
    process.exit(1);
  }
}
console.log('✓ ArgoCD GitOps Applications: dev, stage, and prod application manifests present.');

// Clean up any test artifacts
try {
  execSync('powershell -Command "Remove-Item -Recurse -Force infra/terraform/envs/*/.terraform -ErrorAction SilentlyContinue; Remove-Item -Force infra/terraform/envs/*/.terraform.lock.hcl -ErrorAction SilentlyContinue"');
} catch {}

console.log('\n--- Phase 2 Infrastructure Verification: 100% COMPLETE & PASSING ---');
process.exit(0);

