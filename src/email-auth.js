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
export async function passwordSignup(client,email,password,getSettings){
 const value=address(client,email);if(password.length<8)throw Error('パスワードは8文字以上にしてください。');
 const settings=await getSettings();
 if(settings.mailer_autoconfirm!==false)throw Object.assign(Error('メール確認の設定を確認できないため、新規登録を停止しています。管理者へお問い合わせください。'),{code:'confirmation_configuration'});
 const {data,error}=await client.auth.signUp({email:value,password,options:{emailRedirectTo:AUTH_REDIRECT_URL}});if(error)throw error;
 if(data?.session){await client.auth.signOut({scope:'local'});throw Object.assign(Error('メール確認前のログインを停止しました。管理者へお問い合わせください。'),{code:'confirmation_configuration'});}
 return data;
}
export async function requestPasswordReset(client,email){
 const value=address(client,email);const {error}=await client.auth.resetPasswordForEmail(value,{redirectTo:AUTH_REDIRECT_URL});if(error)throw error;
}

export const SIGNUP_NOTICE='登録リクエストを受け付けました。未登録のアドレスの場合は、届いた確認メールのリンクを開いて登録を完了してください。この画面ではメールの到着や認証完了を確認できません。すでに登録済みの場合、新規登録の確認メールは送信されません。ログインまたはパスワードの再設定をご利用ください。';
export function signupErrorMessage(error){
 if(error.code==='confirmation_configuration')return error.message;
 if(error.status===429||['over_email_send_rate_limit','over_request_rate_limit'].includes(error.code))return 'メール送信または試行回数の上限に達しました。今回は送信を完了できていません。時間をおいてお試しください。';
 if(['email_address_not_authorized','email_address_not_allowed'].includes(error.code))return 'このアドレスへの送信が許可されていません。管理者によるメール配信設定が必要です。';
 if(error.code==='user_already_exists')return '登録済みの場合はログインまたはパスワードの再設定をご利用ください。';
 if(error.status>=500)return '登録処理を完了できませんでした。メール配信などのサービス設定を管理者が確認する必要があります。';
 return '登録処理を完了できませんでした。入力内容を確認し、再試行してください。メールの送信は確認できていません。';
}
