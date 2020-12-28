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

// function filterTime(pullRequest) {
//   const ageInSecs = Math.round((Date.now() - (new Date(pullRequest.created_at).getTime())) / 1000);
//   const minAgeInSecs = parseInt(skipHour) * 60 * 60;
//   if (ageInSecs > minAgeInSecs) {
//     return true;
//   }
//   return false;
// }

function getTimeInactiveInHours(issue) {
  const timeInactiveInHours = Math.round(
    (Date.now() - (new Date(issue.updated_at).getTime())) / (1000 * 60 * 60)
  );
  return timeInactiveInHours;
}

async function main() {
  const issuesRes = await getOpenIssues(repoOwner, repo);
  var issuesAry = issuesRes.data;

  // Remove pull requests -- we only want issues under the "Issues" tab of GitHub
  issuesAry = issuesAry.filter(issue => {
    return issue.pull_request === undefined;
  });

  console.log(issuesAry); // DEBUG

  issuesAry.forEach(issue => {
    const timeInactiveInHours = getTimeInactiveInHours(issue);
    if (timeInactiveInHours >= unassignInactiveInHours) {
      // Unassign the issue
      octokit.issues.removeAssignees({
        owner: repoOwner,
        repo: repo,
        issue_number: issue.number,
        assignees: issue.assignees
      });
    }
  });
}

main();
