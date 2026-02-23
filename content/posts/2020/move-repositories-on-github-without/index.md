---
title: "Move repositories on GitHub without breaking links to PRs"
date: 2020-09-11T02:55:00.001+02:00
tags: ["GitHub"]
author: "Bruno Garcia"
showToc: false
draft: false
aliases:
  - /blogger/2020/move-repositories-on-github-without/
  - /2020/09/move-repositories-on-github-without.html
description: "How to move a Git repository to a new GitHub repo while preserving PR links, tags, and commit history references."
---

Since it took me way too much time to figure this out, I'll write it
down for future references.

I needed to move a git repository from one GitHub repository to another
one that already had code, past PRs, etc. It wasn't a simple *rename*
which would make GitHub redirect everything. It was adding a new history
from one repository to another, while not getting rid of the past tags,
releases.

When you squash a PR on GitHub by default it'll write the commit
*message (#1)*

Where the number following the \# character is the PR number. When
viewing this message on GitHub it'll link to the PR page on the repo.

If you simply push that git repo to another github repository, it'll
link to the wrong PR page.

To fix that you need to rename the *\#1* to a fully qualified PR link
that GitHub understands.

It has the format: `organization/repository#1`

For that, I've used a tool called
[git-filter-repo](https://github.com/newren/git-filter-repo).

```bash
git filter-repo --commit-callback '
  message = commit.message
  new_msg = re.sub(br"(#(\d*))", br"org/repo\1", message, flags=re.MULTILINE)
  print(new_msg)
  commit.message = new_msg
' --refs HEAD
```

On the target repository I created an orphan branch:

```bash
git checkout --orphan main
```

Pull the rewritten repository into *main* branch, and pushed to remote.
That's it.
