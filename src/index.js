//@ts-check
const { lookup } = require('mime-types');
const { randomBytes } = require('crypto');
const { S3Client } = require('@aws-sdk/client-s3');
const { Upload } = require('@aws-sdk/lib-storage');
const core = require('@actions/core');
const fs = require('fs');
const glob = require('glob');
const klawSync = require('klaw-sync');
const path = require('path');
const slash = require('slash').default;

const AWS_KEY_ID = core.getInput('aws_key_id', {
  required: true,
});
const SECRET_ACCESS_KEY = core.getInput('aws_secret_access_key', {
  required: true,
});
const BUCKET = core.getInput('aws_bucket', {
  required: true,
});
const REGION = core.getInput('aws_region', {
  required: false,
});
const SOURCE_DIR = core.getInput('source_dir', {
  required: false,
});
const SOURCE_FILES = core.getInput('source_files', {
  required: false,
});
const DESTINATION_DIR = core.getInput('destination_dir', {
  required: false,
});
const ENDPOINT = core.getInput('endpoint', {
  required: false,
});

/**
 * @type {import('@aws-sdk/client-s3').S3ClientConfig}
 */
const s3ClientConfig = {
  credentials: {
    accessKeyId: AWS_KEY_ID,
    secretAccessKey: SECRET_ACCESS_KEY,
  },
};

if (ENDPOINT) {
  s3ClientConfig.endpoint = ENDPOINT;
  s3ClientConfig.forcePathStyle = true;
}

if (REGION) {
  s3ClientConfig.region = REGION;
} else {
  s3ClientConfig.region = 'us-east-1';
}

const s3Client = new S3Client(s3ClientConfig);

const destinationDir =
  DESTINATION_DIR === '/'
    ? randomBytes(6).toString('base64url')
    : DESTINATION_DIR;

const paths = SOURCE_DIR
  ? klawSync(SOURCE_DIR, {
    nodir: true,
  })
  : SOURCE_FILES
    ? expandSourceFiles(SOURCE_FILES)
    : [];

if (paths.length === 0) {
  core.setFailed('No files to upload');
  process.exit(1);
}

/**
 * @param {string} sourceFiles
 */
function expandSourceFiles(sourceFiles) {
  const patterns = sourceFiles
    .split('\n')
    .map((p) => p.trim())
    .filter((p) => p !== '');
  const fileSet = new Set();

  for (const pattern of patterns) {
    try {
      const matches = glob.sync(pattern, { nodir: true, absolute: true });

      if (matches.length === 0) {
        core.warning(`Glob pattern "${pattern}" matched no files`);
      } else {
        matches.forEach((file) => fileSet.add(file));
      }
    } catch (/** @type {any} */ error) {
      core.setFailed(`Invalid glob pattern "${pattern}": ${error.message}`);
      process.exit(1);
    }
  }

  if (fileSet.size === 0) {
    core.setFailed('No files matched any of the provided glob patterns');
    process.exit(1);
  }

  return Array.from(fileSet).map((file) => ({ path: file }));
}

/**
 * @param {import('@aws-sdk/client-s3').PutObjectCommandInput} params
 */
async function upload(params) {
  try {
    const upload = new Upload({
      client: s3Client,
      params,
    });
    const data = await upload.done();

    const location = ENDPOINT
      ? new URL(
        `${params.Bucket}/${encodeURIComponent(data.Key)}`,
        ENDPOINT,
      ).toString()
      : `https://${params.Bucket}.s3.${REGION || 'us-east-1'}.amazonaws.com/${encodeURIComponent(data.Key)}`;
    core.info(`uploaded - ${data.Key}`);
    core.info(`located - ${location}`);
    return location;
  } catch (/** @type {any} */ err) {
    throw err;
  }
}

/**
 * @returns {Promise<string[]>} Array of uploaded file locations
 */
function run() {
  const sourceDir = slash(path.join(process.cwd(), SOURCE_DIR));
  return Promise.all(
    paths.map((p) => {
      const bucketPath = slash(
        path.join(
          destinationDir,
          slash(
            SOURCE_DIR
              ? path.relative(sourceDir, p.path)
              : path.basename(p.path),
          ),
        ),
      );
      const params = {
        Bucket: BUCKET,
        Body: fs.createReadStream(p.path),
        Key: bucketPath,
        ContentType: lookup(p.path) || 'text/plain',
      };
      return upload(params);
    }),
  );
}

run()
  .then((locations) => {
    core.info(`object key - ${destinationDir}`);
    core.info(`object locations - ${locations}`);
    core.setOutput('object_key', destinationDir);
    core.setOutput('object_locations', locations);
  })
  .catch((err) => {
    core.error(err);
    core.setFailed(err.message);
  });
