import test from 'node:test';
import assert from 'node:assert/strict';
import {requestEmailLink} from '../src/email-auth.js';
test('email link uses the current HTTPS origin and does not create users during login',async()=>{
 let payload;await requestEmailLink({auth:{signInWithOtp:async p=>{payload=p;return {error:null}}}},' runner@example.com ','https://jasmy-running-app.vercel.app');
 assert.deepEqual(payload,{email:'runner@example.com',options:{emailRedirectTo:'https://jasmy-running-app.vercel.app/',shouldCreateUser:false}});
});
test('invalid email does not send and delivery failures propagate',async()=>{
 let calls=0;const failure=Object.assign(Error('rate limited'),{status:429});const client={auth:{signInWithOtp:async()=>{calls++;return {error:failure}}}};
 await assert.rejects(requestEmailLink(client,'invalid','https://example.com'));assert.equal(calls,0);
 await assert.rejects(requestEmailLink(client,'runner@example.com','https://example.com'),e=>e===failure);
 await assert.rejects(requestEmailLink(client,'runner@example.com','http://example.com'));assert.equal(calls,1);
});

test('sign-up explicitly creates users and legacy/preview hosts cannot become redirect destinations',async()=>{
 for(const origin of ['https://jasmy-running-app-hiroshiharada-1914.vercel.app','https://preview.example.com']){
 let payload;await requestEmailLink({auth:{signInWithOtp:async p=>{payload=p;return {error:null}}}},'runner@example.com',origin,{signUp:true});
 assert.equal(payload.options.emailRedirectTo,'https://jasmy-running-app.vercel.app/');assert.equal(payload.options.shouldCreateUser,true);
 }
});
