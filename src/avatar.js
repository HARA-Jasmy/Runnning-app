export async function resizeAvatar(file) {
  if (!['image/jpeg','image/png','image/webp'].includes(file.type)) throw Error('JPEG・PNG・WebPの画像を選択してください。');
  if (file.size > 10 * 1024 * 1024) throw Error('画像は10MB以下にしてください。');
  const url=URL.createObjectURL(file),img=new Image();
  try {
    await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=()=>reject(Error('画像を読み込めませんでした。別の画像を選択してください。'));img.src=url;});
    const canvas=document.createElement('canvas');canvas.width=canvas.height=256;
    const ctx=canvas.getContext('2d'),side=Math.min(img.naturalWidth,img.naturalHeight);
    ctx.fillStyle='#fff';ctx.fillRect(0,0,256,256);
    ctx.drawImage(img,(img.naturalWidth-side)/2,(img.naturalHeight-side)/2,side,side,0,0,256,256);
    return canvas.toDataURL('image/jpeg',0.82);
  } finally {URL.revokeObjectURL(url);}
}
