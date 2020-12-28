const core = require('@actions/core');
const github = require('@actions/github');
const token = core.getInput('token');
const unassignInactiveInHours = core.getInput('unassign_inactive_in_hours');
const warningInactiveInHours = core.getInput('warning_inactive_in_hours');
const repoOwner = github.context.repo.owner;
const repo = github.context.repo.repo;
const octokit = github.getOctokit(token);

async function getOpenIssues(repoOwner, repo) {
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

async function getTimeInactiveInHours(issue) {
  const comments = await octokit.issues.listComments({
    owner: repoOwner,
    repo: repo,
    issue_number: issue.number
  });
  var lastUpdated = null;
  comments.data.reverse().forEach(comment => {
    if (comment.user.login === 'github-actions[bot]') {
      return true;
    }
    else {
      lastUpdated = comment.created_at;
      return false;
    }
  });
  var timeInactiveInHours = null;
  try {
    Math.round(
      (Date.now() - (new Date(lastUpdated).getTime())) / (1000 * 60 * 60)
    );
  }
  catch (e) {
    console.log(e.message);
  }
  return timeInactiveInHours;
}

async function main() {
  // Get all open issues, including PRs.
  const issuesRes = await getOpenIssues(repoOwner, repo);
  if (!issuesRes) return;

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
    if (!timeInactiveInHours) return;
    console.log(`timeInactiveInHours=${timeInactiveInHours}`);
    if (timeInactiveInHours >= unassignInactiveInHours) {
      ////////////////////////
      // Unassign the issue //
      ////////////////////////
      const assigneesAry = issue.assignees.map(assignee => {
        return assignee.login;
      });
      try {
        await octokit.issues.removeAssignees({
          owner: repoOwner,
          repo: repo,
          issue_number: issue.number,
          assignees: assigneesAry
        });
      }
      catch (e) {
        console.log(e.message);
      }
    }
    else if (timeInactiveInHours >= warningInactiveInHours &&
             issue.assignees.length > 0
    ) {
      ///////////////////////
      // Post in the issue //
      ///////////////////////
      const body = `This issue has been inactive for ${timeInactiveInHours} ` +
                   `hours (${(timeInactiveInHours/24).toFixed(2)} days) ` +
                   `and will be automatically unassigned after ${unassignInactiveInHours} ` +
                   `hours (${(unassignInactiveInHours/24).toFixed(2)} days).`;
      try {
        await octokit.issues.createComment({
          owner: repoOwner,
          repo: repo,
          issue_number: issue.number,
          body: body
        });
      }
      catch (e) {
        console.log(e.message);
      }
    }
  });
}

main();
