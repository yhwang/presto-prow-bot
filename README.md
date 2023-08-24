# presto-prow-bot
Leverage the [Kubernetes Prow bot](https://docs.prow.k8s.io/docs/) to enable the `/foo` style
commands in a pull request's comment. The original deployment manifests are from
[here](https://github.com/kubernetes/test-infra/blob/master/config/prow/cluster/starter/starter-s3.yaml) and
[here](https://github.com/kubernetes/test-infra/blob/master/config/prow/cluster/prowjob-crd/prowjob_customresourcedefinition.yaml).

__Note__: Currently, the deployment files under [kustomized](./kustomize/) folder are modifed for IBM Kubernetes Cluster Service.

## Deployment ##

1. First thing first, create 2 namespace, one for the prow bot, the other for the scheduling jobs:
   ```bash
   kubectl create namespace prow
   kubectl create namespace test-pods
   ```

2. Follow the documentation [here](https://docs.prow.k8s.io/docs/getting-started-deploy/#github-app) to create a GitHub App
   and set up appropriate permissions. For the `Actions`, `Read & Write` permission is needed for running the workflow jobs.

3. When creating the GitHub App, you also need to generate `hmac-token` for the Webhooks. Use the following command to generate
   the token, then create a secret to store the token:
   ```bash
   openssl rand -hex 20 > /path/to/hook/secret
   kubectl create secret -n prow generic hmac-token --from-file=hmac=/path/to/hook/secret
   ```

4. Get the APP Id and the private key from GitHub App setting page, then create a secret to store it:
   ```
   kubectl create secret -n prow generic github-token --from-file=cert=/path/to/github/cert --from-literal=appid=<<The ID of your app>>
   kubectl create secret -n test-pods generic github-token --from-file=cert=/path/to/github/cert --from-literal=appid=<<The ID of your app>>
   ```
   The secret is needed by the run-job pod in `test-pods` namespace. So both `prow` and `test-pods` need the secret object.

5. Create a ingress cert under the `prow` namespace for the ingress which is going to be created later
   ```bash
   ibmcloud ks ingress secret create -c <IKS cluster> --name <secret name> --cert-crn <CRN> --namespace prow
   ```
   For the CRN, you can check the CRN by querying existing certs: `ibmcloud ks ingress secret ls -c <cluster name>`

6. Update the `prow-bot.yaml` under `kustomize` directory.
   - update the `<github org>` to the git org that the prow should handle.
   - update the `<cluster url>` to point to the cluster's url.
   - update the `<github repo>` to the repository that the prow should handle.
   - update the `<TLS secret name>` to point to the secret which contains the TLS cert created in previous step.
   - update the `<minio-user>` and `<minio-password>`

7. Deploy the prow bot
   ```bash
   kubectl apply -k kustomize
   ```

### Other Information
- [Kubernetes code review process](https://github.com/kubernetes/community/blob/master/contributors/guide/owners.md#the-code-review-process)
- [GitHub API package for JavaScript](https://github.com/octokit/octokit.js)
- [GitHub API for Workflow](https://docs.github.com/en/rest/actions/workflow-run)
