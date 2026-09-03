require('dotenv').config({ path: '.env.local' });
fetch(`https://jmulrpejxckgjngarlub.supabase.co/rest/v1/?apikey=${process.env.SUPABASE_SERVICE_ROLE_KEY}`)
  .then(res => res.json())
  .then(data => {
      const paths = Object.keys(data.paths).filter(p => p.startsWith('/rpc/'));
      console.log('Available RPCs:');
      console.log(paths.join('\n'));
  })
  .catch(console.error);
