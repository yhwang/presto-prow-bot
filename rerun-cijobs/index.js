import { env, exit } from 'node:process';
import { URL } from 'url';

const pr = env.PULL_NUMBER;
const token = env.TOKEN;
const org = env.REPO_OWNER;
const repo = env.REPO_NAME;
const sha = env.PULL_PULL_SHA;

// Get Pipeline Id based on the pull request number
async function getPipeline(pr) {
  const getPipeline = new URL(`https://circleci.com/api/v2/project/gh/${org}/${repo}/pipeline`);
  getPipeline.searchParams.append('branch', `pull/${pr}`);

  const res = await fetch(getPipeline.href, {
    method: 'GET',
    headers: { 'Circle-Token': `${token}` }
  });

  if (!res.ok) {
    return Promise.reject(new Error(`Failed to get pipeline for the specified pull request: ${res.status}`));
  }
  const items = await res.json();
  if (items.items[0].vcs.revision === sha) {
    return items.items[0];
  }
  return Promise.reject(new Error('Failed to get pipeline for the specified pull reques'));
}


// Get the workflow based on the specified pipelineId and workflow name
// Only return workflow which its status is `failed`
async function getWorkflow(pipelineId, name) {
  const options = {
    method: 'GET',
    headers: { 'Circle-Token': `${token}` }
  };
  const res = await fetch(`https://circleci.com/api/v2/pipeline/${pipelineId}/workflow`, options);
  if (!res.ok) {
    return Promise.reject(new Error(`Failed to get workflow for the pipeline: ${res.status}`));
  }
  const workflows = await res.json();
  for (const workflow of workflows.items) {
    if (workflow.name === name) {
      if (workflow.status === 'failed') {
        return workflow.id;
      } else {
        return Promise.reject(new Error(`Failed to rerun a non-failed workflow: ${workflow.status}`));
      }
    }
  }
  return Promise.reject(new Error(`Failed to get workflow named: ${name}`));
}

// Rerun failed jobs for the specified workflow id
async function rerunWorkflowFromFailedJob(workflowId) {
  const options = {
    method: 'POST',
    headers: { 'Circle-Token': `${token}` },
    body: JSON.stringify({
      from_failed: true,
    })
  };
  return await fetch(`https://circleci.com/api/v2/workflow/${workflowId}/rerun`, options);
}

const pipeline = await getPipeline(pr);
const workflow = await getWorkflow(pipeline.id, env.WORKFLOW);
console.log(workflow);
// const rev = await rerunWorkflowFromFailedJob(workflow.id);
// console.log(rev);
