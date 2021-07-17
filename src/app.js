const mime = require('mime');
const { promises: fs, createWriteStream } = require('fs');
const path = require('path');
const simpleGit = require('simple-git');
const app = require('express')();
const cors = require('cors');
const fileUpload = require('express-fileupload');
const unzipper = require('unzipper');
const NFS_ROOT = path.join(process.cwd(), 'sspt-data');
const jwt = require('jsonwebtoken');

app.use(cors());

// provision endpoint
app.post('/:merchantId', resolveMerchant, gitInit);
app.use('/:merchantId', resolveMerchant, ensureGitHome);

app.get(['/:merchantId/commits', '/:merchantId/commits/*'], listCommits);
app.use(requireAuth);

app.post('/:merchantId/upload', fileUpload(), handleFileUpload);
app.post('/:merchantId/tree/*', requestedFile, createRequestedFile);

app.get(['/:merchantId/tree/*', '/:merchantId/commit/:hash/*'], requestedFile, responseMimeType, showRequestedFile);
app.get(
  ['/:merchantId', '/:merchantId/ls-tree', '/:merchantId/ls-tree/:hash', '/:merchantId/ls-tree/:hash/*'],
  listTree
);
app.use(handleErrors);

module.exports = app;

function requireAuth(req, res, next) {
  // staging public key
  const gatekeeperPublicKey = `-----BEGIN PUBLIC KEY-----
MIGbMBAGByqGSM49AgEGBSuBBAAjA4GGAAQBf4G29YKO64R5bXqJqZKklzxvGltm
ntni9GHHG5ZqF9G/pW0Zdrga4bnwwFwHcaMBMwyOZJkRdh2jgOlipZQmJ6MBp0us
iBQ5ZvYb/XBohNg20pOFJI+RVcj7tM7E4qJbfrPLiSsMZ0Eoq2CqoSQgckhp1ccF
1zhNpnQPcLT+WTukUl0=
-----END PUBLIC KEY-----
`;
  try {
    const token = ((req.headers.authorization || '').match(/^Bearer (.+)/) || [])[1] || req.query.jwt;
    jwt.verify(token, gatekeeperPublicKey, (err, decoded) => {
      console.log(decoded);
      if (err) return next(new ErrorNotAuthorized(err));
      req.user = decoded.user;
      next();
    });
  } catch (err) {
    next(new ErrorNotAuthorized(err));
  }
}

function resolveMerchant(req, res, next) {
  req.merchantId = req.params.merchantId || req.query.merchant_public_id;
  next();
}

async function gitInit(req, res, next) {
  const merchantId = req.merchantId;
  if (!merchantId) return next({ statusCode: 404 });
  const baseDir = path.join(NFS_ROOT, merchantId);
  try {
    const stats = await fs.stat(baseDir).catch(() => false);

    if (!stats) {
      await fs.mkdir(baseDir);
      const git = simpleGit({ baseDir, binary: 'git', maxConcurrentProcesses: 6 });
      await git.init();
      res.status(201);
      res.end();
    }
  } catch (err) {
    next(err);
  }
}
async function ensureGitHome(req, res, next) {
  const merchantId = req.merchantId;
  if (!merchantId) return next({ statusCode: 404 });
  const baseDir = path.join(NFS_ROOT, merchantId);
  try {
    const stats = await fs.stat(baseDir);

    if (!stats.isDirectory()) next({ statusCode: 404 });
    const git = simpleGit({
      baseDir,
      binary: 'git',
      maxConcurrentProcesses: 6,
    });
    if (req.user)
      git
        .addConfig('user.name', `${req.user.first_name} ${req.user.last_name}`)
        .addConfig('user.email', `${req.user.email}`);

    await git.init();
    req.git = git;
    req.baseDir = baseDir;
    next();
  } catch (err) {
    next(err);
  }
}

function requestedFile(req, res, next) {
  if ('0' in req.params) {
    const file = req.params['0'];
    const { dir, base, name, ext } = path.parse(file);

    const filePath = path.join(req.baseDir, dir, base);

    req.requestedFileUri = file;
    req.requestedFile = filePath;
    next();
  } else {
    next({ statusCode: 400 });
  }
}
async function createRequestedFile(req, res, next) {
  const filePath = req.requestedFile;
  await fs.mkdir(path.dirname(req.requestedFile), { recursive: true });
  req.pipe(createWriteStream(filePath));
  req.on('end', async () => {
    await req.git.add(filePath);
    await req.git.commit('POST ' + req.requestedFileUri);
    res.status(201);
    res.end();
  });
}

function responseMimeType(req, res, next) {
  if (req.requestedFile) {
    const type = mime.getType(req.requestedFile);
    res.set('Content-Type', type);
  }
  next();
}

async function showRequestedFile(req, res) {
  res.send(await req.git.show(`${req.params.hash || 'master'}:${req.requestedFileUri}`));
}

async function listTree(req, res, next) {
  try {
    const rs = (
      await req.git.raw('ls-tree', req.params.hash || 'master', req.params[0] || '.', '-r', '--name-only')
    ).trim();
    if (rs) res.send(rs.split('\n'));
    else next({ statusCode: 404 });
  } catch (err) {
    next(err);
  }
}

async function listCommits(req, res) {
  res.send(await req.git.log());
}

async function handleFileUpload(req, res) {
  console.log(req.files);
  const [file] = Object.values(req.files);
  if (file && file.mimetype === 'application/octet-stream') {
    console.log(file.data);
    const directory = await unzipper.Open.buffer(file.data);
    await directory.extract({ path: req.baseDir, concurrency: 5 });
    await req.git.add('--all');
    await req.git.commit('POST upload ' + file.name);

    res.end();
  } else {
    next({ statusCode: 404 });
  }
}

function handleErrors(err, req, res, next) {
  console.error(err);
  if (err && 'statusCode' in err) {
    res.status(err.statusCode).end();
  } else if (err.code === 'ENOENT') {
    res.status(404).end();
  } else {
    res.status(500).end();
  }
}
