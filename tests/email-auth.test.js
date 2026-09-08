import test from 'node:test';
import assert from 'node:assert/strict';
import {passwordLogin,passwordSignup,requestPasswordReset,AUTH_REDIRECT_URL} from '../src/email-auth.js';
test('normal login calls only password auth and never sends email',async()=>{
 let payload;const client={auth:{signInWithPassword:async p=>{payload=p;return {data:{user:{id:'test'},session:{}},error:null}},signInWithOtp:()=>assert.fail('No email on login'),signUp:()=>assert.fail('No sign-up on login')}};
 const data=await passwordLogin(client,' runner@example.com ','test-password');assert.equal(data.user.id,'test');assert.deepEqual(payload,{email:'runner@example.com',password:'test-password'});
});
test('sign-up sets password and canonical confirmation redirect',async()=>{
 let payload;await passwordSignup({auth:{signUp:async p=>{payload=p;return {data:{session:null},error:null}}}},'runner@example.com','test-password');
 assert.deepEqual(payload,{email:'runner@example.com',password:'test-password',options:{emailRedirectTo:AUTH_REDIRECT_URL}});assert.equal(AUTH_REDIRECT_URL,'https://jasmy-running-app.vercel.app/');
});
test('invalid input and upstream errors do not silently sign in',async()=>{
 let calls=0;const error=Error('Invalid credentials');const client={auth:{signInWithPassword:async()=>{calls++;return {error}},signUp:()=>assert.fail('No invalid sign-up')}};
 await assert.rejects(passwordLogin(client,'invalid','x'));await assert.rejects(passwordLogin(client,'runner@example.com',''));assert.equal(calls,0);
 await assert.rejects(passwordLogin(client,'runner@example.com','wrong'),e=>e===error);await assert.rejects(passwordSignup(client,'runner@example.com','short'));
});
test('explicit password reset returns to canonical app',async()=>{
 let args;await requestPasswordReset({auth:{resetPasswordForEmail:async(...a)=>{args=a;return {error:null}}}},'runner@example.com');assert.deepEqual(args,['runner@example.com',{redirectTo:AUTH_REDIRECT_URL}]);
});
