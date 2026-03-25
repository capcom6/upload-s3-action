# Upload S3 ☁️

This action uploads files or directories to AWS S3 or S3-compatible storage.

## Usage

### `workflow.yml` Example

Place in a `.yml` file such as this one in your `.github/workflows` folder. [Refer to the documentation on workflow YAML syntax here.](https://help.github.com/en/articles/workflow-syntax-for-github-actions)

```yaml
name: Upload to S3

on: [pull_request]

jobs:
  upload:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@master
      - uses: capcom6/s3-upload-action@master
        with:
          aws_key_id: ${{ secrets.AWS_KEY_ID }}
          aws_secret_access_key: ${{ secrets.AWS_SECRET_ACCESS_KEY}}
          aws_bucket: ${{ secrets.AWS_BUCKET }}
          source_dir: 'dirname'
```

#### Using with Deployment Action

Recommended for use with [deployment-action](https://github.com/marketplace/actions/deployment-action) in pull requests.

```yaml
name: Deploy for preview

on: [pull_request]

jobs:
  preview:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@master
      - uses: chrnorm/deployment-action@releases/v1
        name: Create GitHub deployment
        id: test
        with:
          token: ${{ secrets.GITHUB_TOKEN}}
          description: 'Preview my app'
          environment: preview

      - uses: capcom6/s3-upload-action@master
        name: Upload S3
        id: S3
        with:
          aws_key_id: ${{ secrets.AWS_KEY_ID }}
          aws_secret_access_key: ${{ secrets.AWS_SECRET_ACCESS_KEY}}
          aws_bucket: ${{ secrets.AWS_BUCKET }}
          source_dir: 'static'

      - name: Update deployment status (success)
        if: success()
        uses: chrnorm/deployment-status@releases/v1
        with:
          token: ${{ secrets.GITHUB_TOKEN }}
          target_url: https://aws-bucket.s3.ap-northeast-2.amazonaws.com/${{steps.S3.outputs.object_key}}/index.html
          state: 'success'
          deployment_id: ${{ steps.test.outputs.deployment_id }}
```

## Action inputs

The following settings must be passed as action inputs as shown in the example. Sensitive information, especially `aws_key_id` and `aws_secret_access_key`, should be [set as encrypted secrets](https://help.github.com/en/articles/virtual-environments-for-github-actions#creating-and-using-secrets-encrypted-variables) — otherwise, they'll be public to anyone browsing your repository's source code.

| name                    | description                                                                                                                                                                    |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `aws_key_id`            | **(Required)** Your AWS Access Key ID. [More info here.](https://docs.aws.amazon.com/general/latest/gr/managing-aws-access-keys.html)                                          |
| `aws_secret_access_key` | **(Required)** Your AWS Secret Access Key. [More info here.](https://docs.aws.amazon.com/general/latest/gr/managing-aws-access-keys.html)                                      |
| `aws_region`            | **(Optional)** The AWS region to upload to. Default: `us-east-1`. [More info here.](https://docs.aws.amazon.com/general/latest/gr/rande.html)                                  |
| `aws_bucket`            | **(Required)** The name of the S3 bucket to upload to.                                                                                                                         |
| `source_dir`            | **(Optional)** The local directory (or file) to upload to S3. Cannot be used together with `source_files`.                                                                     |
| `source_files`          | **(Optional)** The list of files to upload to S3. Supports glob patterns. Examples: `*.js`, `**/*.txt`, `dist/**`, `src/*.{js,ts}`. Cannot be used together with `source_dir`. |
| `destination_dir`       | **(Optional)** The destination directory path in S3. Default: `/` (a random shortid will be generated). To upload to the bucket root, set to empty string `''`.                |
| `endpoint`              | **(Optional)** Custom endpoint URI for S3-compatible storage (e.g., MinIO, DigitalOcean Spaces, etc.).                                                                         |

> **Note:** When using `source_files`, files are uploaded with their basenames only (flat structure). Original directory paths are not retained.

## Action outputs

| name               | description                                                             |
| ------------------ | ----------------------------------------------------------------------- |
| `object_key`       | The destination directory path in S3 (or generated if default was used) |
| `object_locations` | Array of uploaded object URLs (one for each file)                       |

## Migration to AWS SDK v3

This action now uses AWS SDK for JavaScript v3 (`@aws-sdk/client-s3`). This provides better performance, smaller bundle size, and improved modularity.

## License

MIT
