const https = require('https');

const options = {
  hostname: 'firestore.googleapis.com',
  port: 443,
  path: '/v1/projects/gagyeboo-32df9/databases/(default)/documents/transactions?pageSize=100',
  method: 'GET'
};

const req = https.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  res.on('end', () => {
    try {
      const json = JSON.parse(data);
      if (json.documents) {
        console.log(`FOUND ${json.documents.length} TRANSACTIONS!`);
        // 각 문서의 name, amount, category, groupId 출력
        json.documents.forEach((doc, i) => {
          const fields = doc.fields || {};
          const name = fields.name ? fields.name.stringValue : 'No Name';
          const amount = fields.amount ? fields.amount.integerValue : '0';
          const category = fields.category ? fields.category.stringValue : 'No Cat';
          const groupId = fields.groupId ? fields.groupId.stringValue : 'No Group';
          console.log(`[${i}] Name: ${name}, Amt: ${amount}, Cat: ${category}, GroupId: ${groupId}`);
        });
      } else {
        console.log('No documents found in transactions collection.', json);
      }
    } catch (e) {
      console.error('Failed to parse JSON:', e);
      console.log('Raw output:', data);
    }
  });
});

req.on('error', (e) => {
  console.error('Request error:', e);
});

req.end();
