import {readFile} from 'node:fs/promises';
import {startSandbox} from './server.mjs';
const config=await readFile('.local-previews/email-cli/.wrangler/config/default.toml','utf8');
const emailToken=config.match(/oauth_token\s*=\s*"([^"]+)"/)?.[1];
if(!emailToken)throw new Error('Refresh the dedicated email connection first.');
const instance=startSandbox({port:3014,databasePath:'.local-previews/weekly-stage3/email-review.sqlite',emailToken});
instance.server.on('listening',()=>console.log('Email review sandbox ready at http://localhost:3014/my-plan. Only luc@threebyrd.com can receive test mail.'));
