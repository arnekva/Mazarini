# Using GitHub Copilot Coding Agent with VS Code

This guide explains how GitHub Copilot's coding agent (background agents) works, where to find it, and how to connect it to your VS Code workflow.

---

## Overview: GitHub Copilot Coding Agent vs. VS Code Copilot Chat

There are two distinct Copilot surfaces you may encounter:

| Feature | Where it lives | What it does |
|---|---|---|
| **Copilot Chat / Inline suggestions** | Inside VS Code | Real-time code completions and chat inside your editor |
| **Copilot Coding Agent (background agents)** | GitHub web (`github.com/copilot/agents`) | Autonomous agent that works on issues/PRs asynchronously, runs CI, and opens PRs on your behalf |

The coding agent (background agent) is **not** a VS Code panel. It runs on GitHub's servers and appears at [github.com/copilot/agents](https://github.com/copilot/agents). You can, however, open the pull request it creates directly in VS Code once the agent has finished its work.

---

## Starting a Coding Agent Session on GitHub

1. Go to [github.com/copilot/agents](https://github.com/copilot/agents).
2. Click **New agent session** (or the `+` button next to "Background agents").
3. Select the repository and describe the task you want the agent to perform.
4. The agent will create a branch, make code changes, run tests, and open a pull request automatically.

> **Tip:** You can also start an agent directly from a GitHub issue by clicking the ✨ icon or choosing **"Assign to Copilot"** from the issue sidebar.

---

## Opening an Agent-Created PR in VS Code

Once the agent has opened a pull request:

1. Open VS Code and make sure you have the following extensions installed:
   - [**GitHub Copilot**](https://marketplace.visualstudio.com/items?itemName=GitHub.copilot)
   - [**GitHub Pull Requests**](https://marketplace.visualstudio.com/items?itemName=GitHub.vscode-pull-request-github)
2. Sign in to the **same GitHub account** that owns or has access to the repository.
3. Open the **GitHub Pull Requests** panel in the Activity Bar (the GitHub icon on the left).
4. Find the pull request created by the agent and click **Checkout** to review the changes locally.
5. You can then continue editing, comment on the PR, or merge it from within VS Code.

---

## Required Extensions and Sign-in

| Extension | Marketplace link | Required for |
|---|---|---|
| GitHub Copilot | [Install](https://marketplace.visualstudio.com/items?itemName=GitHub.copilot) | Inline completions & Copilot Chat in VS Code |
| GitHub Pull Requests | [Install](https://marketplace.visualstudio.com/items?itemName=GitHub.vscode-pull-request-github) | Viewing and managing agent-created PRs in VS Code |

**Sign-in steps:**

1. In VS Code, open the **Accounts** menu (bottom-left corner, person icon).
2. Click **Sign in with GitHub** and authenticate in the browser.
3. Make sure the account you sign in with is the same one that has access to the repository and the Copilot license.

---

## Common Troubleshooting

### "I can't see 'New agent session' in VS Code"
The coding agent is **not** inside VS Code — it lives at [github.com/copilot/agents](https://github.com/copilot/agents). VS Code only shows Copilot Chat and inline completions.

### "I see the agent at github.com/copilot/agents but nothing in my editor"
This is expected. The agent works in the background on GitHub. When it finishes, it opens a PR which you can check out in VS Code using the GitHub Pull Requests extension.

### "I'm on a Copilot trial — does the coding agent work?"
The coding agent may require a Copilot Enterprise or Business plan depending on your organization's settings. Trial accounts on Copilot Individual may have limited access. Check [GitHub's Copilot plans page](https://github.com/features/copilot#pricing) for details.

### "Wrong GitHub account is signed in"
In VS Code, open the **Accounts** menu → click the currently signed-in account → **Sign out**, then sign in again with the correct account.

### "Extension is out of date"
Open the VS Code Extensions panel, search for "GitHub Copilot" and "GitHub Pull Requests", and click **Update** if available. Agent features require recent extension versions.

### "Feature not available / org policy"
Some organizations disable Copilot coding agent features via policy. Ask your GitHub organization admin to enable **"Copilot coding agent"** under Organization Settings → Copilot → Policies.

---

## Official Resources

- [GitHub Copilot coding agent documentation](https://docs.github.com/en/copilot/using-github-copilot/using-copilot-coding-agent)
- [About GitHub Copilot agents](https://docs.github.com/en/copilot/concepts/about-github-copilot-agents)
- [GitHub Copilot in VS Code](https://code.visualstudio.com/docs/copilot/overview)
- [GitHub Pull Requests extension](https://marketplace.visualstudio.com/items?itemName=GitHub.vscode-pull-request-github)
- [Copilot plans and pricing](https://github.com/features/copilot#pricing)
