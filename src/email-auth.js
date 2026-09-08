export const AUTH_REDIRECT_URL='https://jasmy-running-app.vercel.app/';
function address(client,email){
 if(!client)throw Error('ログインサービスに接続できません。');
 const value=String(email).trim();
 if(value.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))throw Error('メールアドレスを確認してください。');
 return value;
}
export async function passwordLogin(client,email,password){
 const value=address(client,email);if(!password)throw Error('パスワードを入力してください。');
 const {data,error}=await client.auth.signInWithPassword({email:value,password});if(error)throw error;return data;
}
export async function passwordSignup(client,email,password){
 const value=address(client,email);if(password.length<8)throw Error('パスワードは8文字以上にしてください。');
 const {data,error}=await client.auth.signUp({email:value,password,options:{emailRedirectTo:AUTH_REDIRECT_URL}});if(error)throw error;return data;
}
export async function requestPasswordReset(client,email){
 const value=address(client,email);const {error}=await client.auth.resetPasswordForEmail(value,{redirectTo:AUTH_REDIRECT_URL});if(error)throw error;
}
