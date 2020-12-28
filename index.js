const core = require('@actions/core');
const github = require('@actions/github');
const token = core.getInput('token');
const unassignInactiveInHours = core.getInput('unassign_inactive_in_hours');
const warningInactiveInHours = core.getInput('warning_inactive_in_hours');
const repoOwner = github.context.repo.owner;
const repo = github.context.repo.repo;

function getOpenIssues(repoOwner, repo) {
  const octokit = github.getOctokit(token);
  const response = octokit.issues.listForRepo({
    owner: repoOwner,
    repo: repo,
    state: 'open'
  })["catch"](function (e) {
    console.log(e.message);
  });
  return response;
}

function filterTime(pullRequest) {
  const ageInSecs = Math.round((Date.now() - (new Date(pullRequest.created_at).getTime())) / 1000);
  const minAgeInSecs = parseInt(skipHour) * 60 * 60;
  if (ageInSecs > minAgeInSecs) {
    return true;
  }
  return false;
}

async function main() {
  const issues = await getOpenIssues(repoOwner, repo);
  var data = issues.data;
  data = data.filter((ele) => {
    ele.pull_request === undefined;
  });
  console.log(data);
}

main();
