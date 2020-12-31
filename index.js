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
      state: 'open',
      per_page: 100
    });
  }
  catch (e) {
    console.log(e.message);
  }
  return response;
}

async function getTimeInactiveInHours(issue) {
  var lastUpdated = null;

  // Get the latest comment, ignoring comments from the bot.
  const comments = await octokit.issues.listComments({
    owner: repoOwner,
    repo: repo,
    issue_number: issue.number
  });
  comments.data.reverse().forEach(comment => {
    if (comment.user.login === 'github-actions[bot]') {
      return true;
    }
    else {
      lastUpdated = comment.created_at;
      return false;
    }
  });

  if (!lastUpdated) {
    // If we get here, it means there were no comments, or they were all from
    // the bot. So the update time should be the issue creation time.
    lastUpdated = issue.created_at;
  }

  // Check the latest assignment event -- in the case it was recently assigned,
  // we want that to count as an update.
  const events = await octokit.issues.listEvents({
    owner: repoOwner,
    repo: repo,
    issue_number: issue.number
  });
  events.data.reverse().forEach(event => {
    if (event.event === 'assigned') {
      if ((new Date(event.created_at).getTime()) > (new Date(lastUpdated).getTime())) {
        lastUpdated = event.created_at;
      }
      return false; // Found the latest event, no need to continue
    }
  });

  // Convert lastUpdated to timeInactiveInHours
  var timeInactiveInHours = null;
  try {
    timeInactiveInHours = Math.round(
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

  // For inactive issues, unassign the issue or post a warning message
  // in it that it will be unassigned in the near future.
  issuesAry.forEach(async issue => {
    const timeInactiveInHours = await getTimeInactiveInHours(issue);
    if (timeInactiveInHours === null) return;
    console.log(`timeInactiveInHours=${timeInactiveInHours}`);
    if (timeInactiveInHours >= unassignInactiveInHours &&
        issue.assignees.length > 0
    ) {
      ////////////////////////
      // Unassign the issue //
      ////////////////////////
      // Post a message
      const body = `This issue has been inactive for ${timeInactiveInHours} ` +
                    `hours (${(timeInactiveInHours/24).toFixed(2)} days) ` +
                    `and is past the limit of ${unassignInactiveInHours} ` +
                    `hours (${(unassignInactiveInHours/24).toFixed(2)} days) ` +
                    `so is being unassigned.`;
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

      // Unassign the issue
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
      // First check to make sure the previous comment is not from the bot so
      // we don't get a spam of comments.
      const comments = await octokit.issues.listComments({
        owner: repoOwner,
        repo: repo,
        issue_number: issue.number
      });
      if (comments.data.length === 0 ||
          comments.data[comments.data.length - 1].user.login !== 'github-actions[bot]'
      ) {
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
    }
  });
}

main();
