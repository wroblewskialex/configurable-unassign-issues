const core = require('@actions/core');
const github = require('@actions/github');
const token = core.getInput('token');
const unassignInactiveInHours = core.getInput('unassign_inactive_in_hours');
const warningInactiveInHours = core.getInput('warning_inactive_in_hours');
const repoOwner = github.context.repo.owner;
const repo = github.context.repo.repo;

async function getOpenIssues(repoOwner, repo) {
  const octokit = github.getOctokit(token);
  var response = null;
  try {
    response = await octokit.issues.listForRepo({
      owner: repoOwner,
      repo: repo,
      state: 'open'
    });
  }
  catch (e) {
    console.log(e.message);
  }
  return response;
}

function getTimeInactiveInHours(issue) {
  const timeInactiveInHours = Math.round(
    (Date.now() - (new Date(issue.updated_at).getTime())) / (1000 * 60 * 60)
  );
  return timeInactiveInHours;
}

async function main() {
  // Get all open issues, including PRs.
  const issuesRes = await getOpenIssues(repoOwner, repo);
  if (!issuesRes) return;
  console.log(issuesRes);

  // Remove pull requests -- we only want issues under the "Issues" tab of GitHub
  var issuesAry = issuesRes.data;
  issuesAry = issuesAry.filter(issue => {
    return issue.pull_request === undefined;
  });

  console.log(issuesAry); // DEBUG

  // For inactive issues, unassign the issue or post a warning message
  // in it that it will be unassigned in the near future.
  issuesAry.forEach(async issue => {
    const timeInactiveInHours = getTimeInactiveInHours(issue);
    if (timeInactiveInHours >= unassignInactiveInHours) {
      ////////////////////////
      // Unassign the issue //
      ////////////////////////
      try {
        await octokit.issues.removeAssignees({
          owner: repoOwner,
          repo: repo,
          issue_number: issue.number,
          assignees: issue.assignees
        });
      }
      catch (e) {
        console.log(e.message);
      }
    }
    else if (timeInactiveInHours >= warningInactiveInHours) {
      ///////////////////////
      // Post in the issue //
      ///////////////////////
    }
  });
}

main();
