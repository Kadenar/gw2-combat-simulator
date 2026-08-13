# Community build submissions

Community builds are submitted through a GitHub Issue Form. GitHub requires the
submitter to sign in, hosts the uploaded files, and records the submitting
account. A submission opens an issue for maintainer review; it does not create
a branch or pull request automatically.

## User flow

1. Select **Submit a build** on the simulator landing page or a profession page.
2. Sign in to GitHub if prompted.
3. Complete the build-submission form.
4. Upload the exported `build.json` and matching `rotation.json` files.
5. Submit the issue.

The form also requests the preset name, profession, specialization, optional
benchmark source, expected simulator DPS, and reviewer notes. Attachments in a
public repository are public, so the form warns contributors to remove private
notes and identifying information.

## Repository setup

The form is defined in
[`../.github/ISSUE_TEMPLATE/build-submission.yml`](../.github/ISSUE_TEMPLATE/build-submission.yml).
It becomes available after that file is merged into the repository's default
branch.

In the repository's **Settings → General → Features**, ensure **Issues** is
enabled. No GitHub App, OAuth application, serverless endpoint, Turnstile
widget, deployment secret, or repository variable is required.

GitHub currently supports `.json` uploads in Issue Forms. Each submitted file
must remain within GitHub's attachment limits.

## Maintainer review

For each submission:

1. Confirm the issue contains both JSON files and sufficient attribution.
2. Download the files and inspect rotation metadata for private or irrelevant
   data.
3. Load and replay the pair in the simulator.
4. Confirm the profession, specialization, warnings, and rounded DPS.
5. If accepted, add the build, rotation, and manifest entry on a maintainer
   branch and open a normal pull request.
6. Link the pull request to the submission issue and close the issue after the
   pull request is merged or rejected.

Labels such as `build-submission`, `needs-review`, `accepted`, and `rejected`
can be added in GitHub for moderation, but the form does not depend on them.

## Optional future automation

A maintainer-only workflow can later accept an issue number and prepare a pull
request after approval. Keep that workflow manually dispatched or gated behind
a maintainer-controlled label so unreviewed submissions never create branches
or pull requests.
