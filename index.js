const core = require("@actions/core");
const github = require("@actions/github");
const { execSync } = require("child_process");
const exec = require("@actions/exec");

const context = github.context;

const zeitToken = core.getInput("zeit-token");
const nowArgs = core.getInput("now-args");
const githubToken = core.getInput("github-token");
const workingDirectory = core.getInput("working-directory");
const nowOrgId = core.getInput("now-org-id");
const nowProjectId = core.getInput("now-project-id");

let octokit;
if (githubToken) {
  octokit = new github.GitHub(githubToken);
}

async function run() {
  await setEnv();

  const deploymentUrl = await nowDeploy();
  if (deploymentUrl) {
    core.info("set preview-url output");
    core.setOutput("preview-url", `https://${deploymentUrl}`);
  } else {
    core.warning("get preview-url error");
  }
}

async function setEnv() {
  core.info("set environment for now cli 17+");
  if (nowOrgId) {
    core.info("set env variable : NOW_ORG_ID");
    core.exportVariable("NOW_ORG_ID", nowOrgId);
  }
  if (nowProjectId) {
    core.info("set env variable : NOW_PROJECT_ID");
    core.exportVariable("NOW_PROJECT_ID", nowProjectId);
  }
}

async function nowDeploy() {
  const commit = execSync("git log -1 --pretty=format:%B")
    .toString()
    .trim();

  let myOutput = "";
  let myError = "";
  const options = {};
  options.listeners = {
    stdout: data => {
      myOutput += data.toString();
      core.info(data.toString());
    },
    stderr: data => {
      myError += data.toString();
      core.info(data.toString());
    }
  };
  if (workingDirectory) {
    options.cwd = workingDirectory;
  }

  await exec.exec(
    "npx",
    [
      "now",
      ...nowArgs.split(/ +/),
      "-t",
      zeitToken,
      "-m",
      `githubCommitSha=${context.sha}`,
      "-m",
      `githubCommitAuthorName=${context.actor}`,
      "-m",
      `githubCommitAuthorLogin=${context.actor}`,
      "-m",
      "githubDeployment=1",
      "-m",
      `githubOrg=${context.repo.owner}`,
      "-m",
      `githubRepo=${context.repo.repo}`,
      "-m",
      `githubCommitOrg=${context.repo.owner}`,
      "-m",
      `githubCommitRepo=${context.repo.repo}`,
      "-m",
      `githubCommitMessage=${commit}`
    ],
    options
  );

  const [first] = myOutput.split("- Queued");
  const groups = first.match(/\n(.+)/g);
  if (groups) {
    return groups[groups.length - 1];
  }

  return {};
}

run().catch(error => {
  core.setFailed(error.message);
});
