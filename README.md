## Self service program templates

Backend data source to read/write files for merchant self service

### Internals

Each merchant is provissioned with an empty git repo under `sspt-data/<merchantId>`. Express api performs basic operations such as create/read/list files and read git history


#### API routes

```js
// provision endpoint
app.post('/:merchantId', resolveMerchant, gitInit);


app.get(['/:merchantId/commits', '/:merchantId/commits/*'], listCommits);
app.use(requireAuth);

// Accept a file upload 
app.post('/:merchantId/upload', fileUpload(), handleFileUpload);
app.post('/:merchantId/tree/*', requestedFile, createRequestedFile);

app.get(['/:merchantId/tree/*', '/:merchantId/commit/:hash/*'], requestedFile, responseMimeType, showRequestedFile);
app.get(
  ['/:merchantId', '/:merchantId/ls-tree', '/:merchantId/ls-tree/:hash', '/:merchantId/ls-tree/:hash/*'],
  listTree
);
```

#### Authorization 
This microservice uses JWT authorization (rc3 token)

```sh
curl -H 'Authorization: Bearer <JWT>'  ...
```

### GET /:merchantId - Listing all files


```sh
curl -H 'Authorization: Bearer <JWT>' http://localhost:3031/d4ce4ebe635211e8bf29bc764e1107f2/
```


#### POST /:merchantId/upload - uplaod a zip file 

Allow upload a zip file to merchant repo

```sh
curl -X POST -H 'Authorization: Bearer <JWT>' -F 'data=@/Users/oguke/Downloads/smi-template-6.zip' http://localhost:3031/d4ce4ebe635211e8bf29bc764e1107f2/upload
```


#### POST /:merchantId/tree/<any file path>

Allow create a file into path, conent is read from request body as buffer

```sh
curl  -H 'Authorization: Bearer <JWT>' http://0.0.0.0:3031/abc/README.txt -d "Hola mundo"
```
Will cretae a README.txt file for merchant

