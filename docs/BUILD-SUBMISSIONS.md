# Community build submissions

Submit community builds through the repository's GitHub Issue Form. Submissions open an issue for maintainer review.

## User flow

1. Select **Submit a build** on the simulator landing page or a profession page.
2. Sign in to GitHub if prompted.
3. Complete the build-submission form.
4. Upload the exported `build.json` and matching `rotation.json` files.
5. Submit the issue.

Include the preset name, profession, and specialization; benchmark source, expected simulator DPS, and reviewer notes
are optional. Attachments are public, so remove private notes and identifying information.

## Repository setup

The form is defined in [build-submission.yml](../.github/ISSUE_TEMPLATE/build-submission.yml). Enable **Issues** in
repository settings and keep the form on the default branch.

## Maintainer review

For each submission:

1. Confirm the issue contains both JSON files and sufficient attribution.
2. Download the files and inspect rotation metadata for private or irrelevant data.
3. Load and replay the pair in the simulator.
4. Confirm the profession, specialization, warnings, and rounded DPS. Resolve warnings or document and scope an
   intentional warning rather than suppressing it.
5. If accepted, add the build, rotation, and manifest entry on a maintainer branch and open a normal pull request.
6. Link the pull request to the submission issue and close the issue after the pull request is merged or rejected.
