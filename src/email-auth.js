export async function requestEmailLink(client,email,origin){
 if(!client)throw Error('ログインサービスに接続できません。');
 const address=String(email).trim();
 if(address.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address))throw Error('メールアドレスを確認してください。');
 const url=new URL(origin);
 if(url.protocol!=='https:'&&url.hostname!=='localhost'&&url.hostname!=='127.0.0.1')throw Error('HTTPSで開いてください。');
 const {error}=await client.auth.signInWithOtp({email:address,options:{emailRedirectTo:url.origin,shouldCreateUser:true}});
 if(error)throw error;
}
