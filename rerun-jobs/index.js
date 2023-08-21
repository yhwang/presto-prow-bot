import { App } from "octokit";
import { env } from 'node:process';
import { readFileSync } from 'node:fs';
import { exit } from 'node:process';

const keyPath = env.KEY_PATH || '/secrets/github-app/cert';
const keyStr = readFileSync(keyPath, {encoding: 'ascii'});
const jobSpec = JSON.parse(env.JOB_SPEC);
const appId = jobSpec.decoration_config.github_app_id;
const app = new App({
    appId: appId,
    privateKey: keyStr,
});

// Get installation id for the specified repo
const getAppInstallationId = async (app) => {
    const rev = await app.octokit.request(`/repos/${env.REPO_OWNER}/${env.REPO_NAME}/installation`);
    if (rev.status == 200) {
        return rev.data.id;
    }
    return ""
};

// Get RunId for the specified workflow name
const getRunIdByName = async (octokit, name) => {
    const rev = await octokit.rest.actions.listWorkflowRunsForRepo({
        owner: env.REPO_OWNER,
        repo: env.REPO_NAME,
        head_sha: env.PULL_PULL_SHA,
        event: 'pull_request OR pull_request_target',
        branch: env.PULL_HEAD_REF,
    });
    var runId = ""
    if (rev.status == 200) {
        rev.data.workflow_runs.forEach((run) => {
            if (run.name === name) {
                runId = run.id;
                return;
            }
        });
    }
    return runId;
}

// Call the `rerun-failed-jobs` api to run the failed jobs for the specified RunId
const rerunFailedJobs = async (octokit, runId) => {
    return await octokit.rest.actions.reRunWorkflowFailedJobs({
        owner: env.REPO_OWNER,
        repo: env.REPO_NAME,
        run_id: runId
    });
};

// main start here
const installationId = await getAppInstallationId(app);
if (installationId === "") {
    console.log(`Can't get installation id. Failed to rerun the failed jobs for workflow: ${env.WORKFLOW}`);
    exit(1);
}
const octokit = await app.getInstallationOctokit(installationId);
const runId = await getRunIdByName(octokit, env.WORKFLOW.trim());
if (runId === "") {
    console.log(`Can't get RunId for the workflow: ${env.WORKFLOW}. Failed to rerun the failed jobs`)
    exit(1);
}

const result = await rerunFailedJobs(octokit, runId);
if (result.status >= 200 && result.status < 300) {
    console.log(`Successfully rerun the failed jobs for the workflow: ${env.WORKFLOW}`);
} else {
    console.log(`Failed to return the failed jobs for workflow: ${env.WORKFLOW}`);
    console.log(JSON.stringify(result, "", "  "));
}