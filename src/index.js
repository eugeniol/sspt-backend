const { get, checkConfig, getInt } = require('./config');

checkConfig();

const app = require('./app');

process.on('unhandledRejection', (error) => {
  // Will print "unhandledRejection err is not defined"
  console.error('unhandledRejection', error.message, error.stack);
});

if (require.main === module) {
  app.listen(getInt('server_port'), get('server_host'), () => {
    console.log(`
    ===============================================
    Starting ${/^dev/.test(process.env.NODE_ENV) ? 'DEVELOPMENT' : 'PRODUCTION'} mode server on http://${get(
      'server_host'
    )}:${get('server_port')}
    ===============================================
         `);
  });
}
