const core = require('@actions/core');
const S3 = require('aws-sdk/clients/s3');
const fs = require('fs');
const path = require('path');
const shortid = require('shortid');
const slash = require('slash').default;
const klawSync = require('klaw-sync');
const { lookup } = require('mime-types');

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

const s3options = {
  accessKeyId: AWS_KEY_ID,
  secretAccessKey: SECRET_ACCESS_KEY,
};

if (ENDPOINT) {
  s3options.endpoint = ENDPOINT;
}

if (REGION) {
  s3options.region = REGION;
}

const s3 = new S3(s3options);
const destinationDir = DESTINATION_DIR === '/' ? shortid() : DESTINATION_DIR;
const paths = SOURCE_DIR
  ? klawSync(SOURCE_DIR, {
      nodir: true,
    })
  : SOURCE_FILES
    ? SOURCE_FILES.split('\n').map((f) => ({ path: f }))
    : [];

if (paths.length === 0) {
  core.setFailed('No files to upload');
  process.exit(1);
}

function upload(params) {
  return new Promise((resolve) => {
    s3.upload(params, (err, data) => {
      if (err) core.error(err);
      core.info(`uploaded - ${data.Key}`);
      core.info(`located - ${data.Location}`);
      resolve(data.Location);
    });
  });
}

function run() {
  const sourceDir = slash(path.join(process.cwd(), SOURCE_DIR));
  return Promise.all(
    paths.map((p) => {
      const fileStream = fs.createReadStream(p.path);
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
        Body: fileStream,
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
