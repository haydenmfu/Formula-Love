// Preset profile pictures: 8x8 pixel sprites. a = body, b = ink, c = accent, '.' = empty.
export const AVATARS={
 cat:{label:'Cat',colors:{a:'#d9a066',b:'#3b2f2a',c:'#e48a9b'},rows:['a......a','aa....aa','aaaaaaaa','abaaaaba','aaacaaaa','aaaaaaaa','.aaaaaa.','..a..a..']},
 fox:{label:'Fox',colors:{a:'#d9773b',b:'#2b211b',c:'#f3ece2'},rows:['a......a','aa....aa','aaaaaaaa','abaaaaba','ccaaaacc','.ccbbcc.','..cccc..','...cc...']},
 frog:{label:'Frog',colors:{a:'#7fb069',b:'#2f3b2a',c:'#e48a9b'},rows:['.aa..aa.','abaaaaba','aaaaaaaa','acaaaaca','abbbbbba','aaaaaaaa','.aaaaaa.','........']},
 bear:{label:'Bear',colors:{a:'#8d6748',b:'#2b211b',c:'#d9b48f'},rows:['aa....aa','aaaaaaaa','abaaaaba','aaaaaaaa','aaccccaa','aacbbcaa','aaccccaa','.aaaaaa.']},
 ghost:{label:'Ghost',colors:{a:'#e9e6f2',b:'#3b3550',c:'#c9a3d9'},rows:['..aaaa..','.aaaaaa.','aabaabaa','aabaabaa','acaaaaca','aaabbaaa','aaaaaaaa','a.aa.aa.']},
 robot:{label:'Robot',colors:{a:'#b7c4cf',b:'#4a5560',c:'#e0a94f'},rows:['...cc...','...b....','bbbbbbbb','baaaaaab','bacaacab','baaaaaab','babbbbab','bbbbbbbb']},
 mushroom:{label:'Mushroom',colors:{a:'#c4504f',b:'#3b2f2a',c:'#f1e6d6'},rows:['..aaaa..','.acaaca.','aaaaaaaa','acaaaaca','..cccc..','..cbbc..','..cccc..','..cccc..']},
 star:{label:'Star',colors:{a:'#e8c547',b:'#4a3b14',c:'#e8c547'},rows:['...aa...','...aa...','aaaaaaaa','.abaaba.','..aaaa..','.aaaaaa.','.aa..aa.','a......a']}
};
export const AVATAR_IDS=Object.keys(AVATARS);
// Accounts without a chosen picture get a stable preset derived from their ID.
export function avatarFor(avatar,seed=''){if(AVATARS[avatar])return avatar;let h=0;for(const c of String(seed))h=(h*31+c.charCodeAt(0))>>>0;return AVATAR_IDS[h%AVATAR_IDS.length];}
export function avatarSvg(avatar,seed,size=28){const id=avatarFor(avatar,seed),{colors,rows}=AVATARS[id];let px='';rows.forEach((row,y)=>[...row].forEach((c,x)=>{if(c!=='.')px+=`<rect x="${x+1}" y="${y+1}" width="1" height="1" fill="${colors[c]}"/>`;}));return `<svg class="avatar-art" width="${size}" height="${size}" viewBox="0 0 10 10" shape-rendering="crispEdges" role="img" aria-label="${AVATARS[id].label}">${px}</svg>`;}
