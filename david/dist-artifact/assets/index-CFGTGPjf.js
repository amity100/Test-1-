var K0=Object.defineProperty;var Z0=(r,t,e)=>t in r?K0(r,t,{enumerable:!0,configurable:!0,writable:!0,value:e}):r[t]=e;var b=(r,t,e)=>Z0(r,typeof t!="symbol"?t+"":t,e);(function(){const t=document.createElement("link").relList;if(t&&t.supports&&t.supports("modulepreload"))return;for(const i of document.querySelectorAll('link[rel="modulepreload"]'))n(i);new MutationObserver(i=>{for(const s of i)if(s.type==="childList")for(const o of s.addedNodes)o.tagName==="LINK"&&o.rel==="modulepreload"&&n(o)}).observe(document,{childList:!0,subtree:!0});function e(i){const s={};return i.integrity&&(s.integrity=i.integrity),i.referrerPolicy&&(s.referrerPolicy=i.referrerPolicy),i.crossOrigin==="use-credentials"?s.credentials="include":i.crossOrigin==="anonymous"?s.credentials="omit":s.credentials="same-origin",s}function n(i){if(i.ep)return;i.ep=!0;const s=e(i);fetch(i.href,s)}})();/**
 * @license
 * Copyright 2010-2024 Three.js Authors
 * SPDX-License-Identifier: MIT
 */const ul="169",J0=0,nh=1,Q0=2,Gu=1,Wu=2,li=3,Bi=0,sn=1,cn=2,jn=0,ss=1,Uo=2,ih=3,sh=4,zo=5,Li=100,td=101,ed=102,nd=103,id=104,sd=200,pc=201,rd=202,od=203,mc=204,gc=205,ad=206,cd=207,ld=208,hd=209,ud=210,dd=211,fd=212,pd=213,md=214,vc=0,xc=1,_c=2,Bs=3,yc=4,Mc=5,bc=6,Sc=7,qu=0,gd=1,vd=2,Yn=0,Xu=1,ju=2,xd=3,Yu=4,_d=5,$u=6,Ku=7,rh="attached",yd="detached",Zu=300,Os=301,Hs=302,wc=303,Tc=304,Jo=306,Fo=1e3,is=1001,Ec=1002,en=1003,Md=1004,Fr=1005,bn=1006,pa=1007,Di=1008,ti=1009,Ju=1010,Qu=1011,Cr=1012,dl=1013,rs=1014,fn=1015,xi=1016,fl=1017,pl=1018,Vs=1020,t0=35902,e0=1021,n0=1022,Sn=1023,i0=1024,s0=1025,zi=1026,Gs=1027,ml=1028,gl=1029,vl=1030,xl=1031,_l=1033,Ao=33776,Ro=33777,Co=33778,Po=33779,Ac=35840,Rc=35841,Cc=35842,Pc=35843,Lc=36196,kc=37492,Dc=37496,Ic=37808,Nc=37809,Uc=37810,zc=37811,Fc=37812,Bc=37813,Oc=37814,Hc=37815,Vc=37816,Gc=37817,Wc=37818,qc=37819,Xc=37820,jc=37821,Lo=36492,Yc=36494,$c=36495,r0=36283,Kc=36284,Zc=36285,Jc=36286,bd=3200,Sd=3201,o0=0,wd=1,ui="",Mn="srgb",Hi="srgb-linear",yl="display-p3",Qo="display-p3-linear",Bo="linear",Ee="srgb",Oo="rec709",Ho="p3",cs=7680,oh=519,Td=512,Ed=513,Ad=514,a0=515,Rd=516,Cd=517,Pd=518,Ld=519,Qc=35044,ks=35048,ah="300 es",di=2e3,Vo=2001;class Zs{addEventListener(t,e){this._listeners===void 0&&(this._listeners={});const n=this._listeners;n[t]===void 0&&(n[t]=[]),n[t].indexOf(e)===-1&&n[t].push(e)}hasEventListener(t,e){if(this._listeners===void 0)return!1;const n=this._listeners;return n[t]!==void 0&&n[t].indexOf(e)!==-1}removeEventListener(t,e){if(this._listeners===void 0)return;const i=this._listeners[t];if(i!==void 0){const s=i.indexOf(e);s!==-1&&i.splice(s,1)}}dispatchEvent(t){if(this._listeners===void 0)return;const n=this._listeners[t.type];if(n!==void 0){t.target=this;const i=n.slice(0);for(let s=0,o=i.length;s<o;s++)i[s].call(this,t);t.target=null}}}const Ze=["00","01","02","03","04","05","06","07","08","09","0a","0b","0c","0d","0e","0f","10","11","12","13","14","15","16","17","18","19","1a","1b","1c","1d","1e","1f","20","21","22","23","24","25","26","27","28","29","2a","2b","2c","2d","2e","2f","30","31","32","33","34","35","36","37","38","39","3a","3b","3c","3d","3e","3f","40","41","42","43","44","45","46","47","48","49","4a","4b","4c","4d","4e","4f","50","51","52","53","54","55","56","57","58","59","5a","5b","5c","5d","5e","5f","60","61","62","63","64","65","66","67","68","69","6a","6b","6c","6d","6e","6f","70","71","72","73","74","75","76","77","78","79","7a","7b","7c","7d","7e","7f","80","81","82","83","84","85","86","87","88","89","8a","8b","8c","8d","8e","8f","90","91","92","93","94","95","96","97","98","99","9a","9b","9c","9d","9e","9f","a0","a1","a2","a3","a4","a5","a6","a7","a8","a9","aa","ab","ac","ad","ae","af","b0","b1","b2","b3","b4","b5","b6","b7","b8","b9","ba","bb","bc","bd","be","bf","c0","c1","c2","c3","c4","c5","c6","c7","c8","c9","ca","cb","cc","cd","ce","cf","d0","d1","d2","d3","d4","d5","d6","d7","d8","d9","da","db","dc","dd","de","df","e0","e1","e2","e3","e4","e5","e6","e7","e8","e9","ea","eb","ec","ed","ee","ef","f0","f1","f2","f3","f4","f5","f6","f7","f8","f9","fa","fb","fc","fd","fe","ff"];let ch=1234567;const wr=Math.PI/180,Pr=180/Math.PI;function $n(){const r=Math.random()*4294967295|0,t=Math.random()*4294967295|0,e=Math.random()*4294967295|0,n=Math.random()*4294967295|0;return(Ze[r&255]+Ze[r>>8&255]+Ze[r>>16&255]+Ze[r>>24&255]+"-"+Ze[t&255]+Ze[t>>8&255]+"-"+Ze[t>>16&15|64]+Ze[t>>24&255]+"-"+Ze[e&63|128]+Ze[e>>8&255]+"-"+Ze[e>>16&255]+Ze[e>>24&255]+Ze[n&255]+Ze[n>>8&255]+Ze[n>>16&255]+Ze[n>>24&255]).toLowerCase()}function He(r,t,e){return Math.max(t,Math.min(e,r))}function Ml(r,t){return(r%t+t)%t}function kd(r,t,e,n,i){return n+(r-t)*(i-n)/(e-t)}function Dd(r,t,e){return r!==t?(e-r)/(t-r):0}function Tr(r,t,e){return(1-e)*r+e*t}function Id(r,t,e,n){return Tr(r,t,1-Math.exp(-e*n))}function Nd(r,t=1){return t-Math.abs(Ml(r,t*2)-t)}function Ud(r,t,e){return r<=t?0:r>=e?1:(r=(r-t)/(e-t),r*r*(3-2*r))}function zd(r,t,e){return r<=t?0:r>=e?1:(r=(r-t)/(e-t),r*r*r*(r*(r*6-15)+10))}function Fd(r,t){return r+Math.floor(Math.random()*(t-r+1))}function Bd(r,t){return r+Math.random()*(t-r)}function Od(r){return r*(.5-Math.random())}function Hd(r){r!==void 0&&(ch=r);let t=ch+=1831565813;return t=Math.imul(t^t>>>15,t|1),t^=t+Math.imul(t^t>>>7,t|61),((t^t>>>14)>>>0)/4294967296}function Vd(r){return r*wr}function Gd(r){return r*Pr}function Wd(r){return(r&r-1)===0&&r!==0}function qd(r){return Math.pow(2,Math.ceil(Math.log(r)/Math.LN2))}function Xd(r){return Math.pow(2,Math.floor(Math.log(r)/Math.LN2))}function jd(r,t,e,n,i){const s=Math.cos,o=Math.sin,a=s(e/2),c=o(e/2),l=s((t+n)/2),h=o((t+n)/2),d=s((t-n)/2),f=o((t-n)/2),u=s((n-t)/2),m=o((n-t)/2);switch(i){case"XYX":r.set(a*h,c*d,c*f,a*l);break;case"YZY":r.set(c*f,a*h,c*d,a*l);break;case"ZXZ":r.set(c*d,c*f,a*h,a*l);break;case"XZX":r.set(a*h,c*m,c*u,a*l);break;case"YXY":r.set(c*u,a*h,c*m,a*l);break;case"ZYZ":r.set(c*m,c*u,a*h,a*l);break;default:console.warn("THREE.MathUtils: .setQuaternionFromProperEuler() encountered an unknown order: "+i)}}function On(r,t){switch(t.constructor){case Float32Array:return r;case Uint32Array:return r/4294967295;case Uint16Array:return r/65535;case Uint8Array:return r/255;case Int32Array:return Math.max(r/2147483647,-1);case Int16Array:return Math.max(r/32767,-1);case Int8Array:return Math.max(r/127,-1);default:throw new Error("Invalid component type.")}}function xe(r,t){switch(t.constructor){case Float32Array:return r;case Uint32Array:return Math.round(r*4294967295);case Uint16Array:return Math.round(r*65535);case Uint8Array:return Math.round(r*255);case Int32Array:return Math.round(r*2147483647);case Int16Array:return Math.round(r*32767);case Int8Array:return Math.round(r*127);default:throw new Error("Invalid component type.")}}const Bt={DEG2RAD:wr,RAD2DEG:Pr,generateUUID:$n,clamp:He,euclideanModulo:Ml,mapLinear:kd,inverseLerp:Dd,lerp:Tr,damp:Id,pingpong:Nd,smoothstep:Ud,smootherstep:zd,randInt:Fd,randFloat:Bd,randFloatSpread:Od,seededRandom:Hd,degToRad:Vd,radToDeg:Gd,isPowerOfTwo:Wd,ceilPowerOfTwo:qd,floorPowerOfTwo:Xd,setQuaternionFromProperEuler:jd,normalize:xe,denormalize:On};class ct{constructor(t=0,e=0){ct.prototype.isVector2=!0,this.x=t,this.y=e}get width(){return this.x}set width(t){this.x=t}get height(){return this.y}set height(t){this.y=t}set(t,e){return this.x=t,this.y=e,this}setScalar(t){return this.x=t,this.y=t,this}setX(t){return this.x=t,this}setY(t){return this.y=t,this}setComponent(t,e){switch(t){case 0:this.x=e;break;case 1:this.y=e;break;default:throw new Error("index is out of range: "+t)}return this}getComponent(t){switch(t){case 0:return this.x;case 1:return this.y;default:throw new Error("index is out of range: "+t)}}clone(){return new this.constructor(this.x,this.y)}copy(t){return this.x=t.x,this.y=t.y,this}add(t){return this.x+=t.x,this.y+=t.y,this}addScalar(t){return this.x+=t,this.y+=t,this}addVectors(t,e){return this.x=t.x+e.x,this.y=t.y+e.y,this}addScaledVector(t,e){return this.x+=t.x*e,this.y+=t.y*e,this}sub(t){return this.x-=t.x,this.y-=t.y,this}subScalar(t){return this.x-=t,this.y-=t,this}subVectors(t,e){return this.x=t.x-e.x,this.y=t.y-e.y,this}multiply(t){return this.x*=t.x,this.y*=t.y,this}multiplyScalar(t){return this.x*=t,this.y*=t,this}divide(t){return this.x/=t.x,this.y/=t.y,this}divideScalar(t){return this.multiplyScalar(1/t)}applyMatrix3(t){const e=this.x,n=this.y,i=t.elements;return this.x=i[0]*e+i[3]*n+i[6],this.y=i[1]*e+i[4]*n+i[7],this}min(t){return this.x=Math.min(this.x,t.x),this.y=Math.min(this.y,t.y),this}max(t){return this.x=Math.max(this.x,t.x),this.y=Math.max(this.y,t.y),this}clamp(t,e){return this.x=Math.max(t.x,Math.min(e.x,this.x)),this.y=Math.max(t.y,Math.min(e.y,this.y)),this}clampScalar(t,e){return this.x=Math.max(t,Math.min(e,this.x)),this.y=Math.max(t,Math.min(e,this.y)),this}clampLength(t,e){const n=this.length();return this.divideScalar(n||1).multiplyScalar(Math.max(t,Math.min(e,n)))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this}negate(){return this.x=-this.x,this.y=-this.y,this}dot(t){return this.x*t.x+this.y*t.y}cross(t){return this.x*t.y-this.y*t.x}lengthSq(){return this.x*this.x+this.y*this.y}length(){return Math.sqrt(this.x*this.x+this.y*this.y)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)}normalize(){return this.divideScalar(this.length()||1)}angle(){return Math.atan2(-this.y,-this.x)+Math.PI}angleTo(t){const e=Math.sqrt(this.lengthSq()*t.lengthSq());if(e===0)return Math.PI/2;const n=this.dot(t)/e;return Math.acos(He(n,-1,1))}distanceTo(t){return Math.sqrt(this.distanceToSquared(t))}distanceToSquared(t){const e=this.x-t.x,n=this.y-t.y;return e*e+n*n}manhattanDistanceTo(t){return Math.abs(this.x-t.x)+Math.abs(this.y-t.y)}setLength(t){return this.normalize().multiplyScalar(t)}lerp(t,e){return this.x+=(t.x-this.x)*e,this.y+=(t.y-this.y)*e,this}lerpVectors(t,e,n){return this.x=t.x+(e.x-t.x)*n,this.y=t.y+(e.y-t.y)*n,this}equals(t){return t.x===this.x&&t.y===this.y}fromArray(t,e=0){return this.x=t[e],this.y=t[e+1],this}toArray(t=[],e=0){return t[e]=this.x,t[e+1]=this.y,t}fromBufferAttribute(t,e){return this.x=t.getX(e),this.y=t.getY(e),this}rotateAround(t,e){const n=Math.cos(e),i=Math.sin(e),s=this.x-t.x,o=this.y-t.y;return this.x=s*n-o*i+t.x,this.y=s*i+o*n+t.y,this}random(){return this.x=Math.random(),this.y=Math.random(),this}*[Symbol.iterator](){yield this.x,yield this.y}}class Qt{constructor(t,e,n,i,s,o,a,c,l){Qt.prototype.isMatrix3=!0,this.elements=[1,0,0,0,1,0,0,0,1],t!==void 0&&this.set(t,e,n,i,s,o,a,c,l)}set(t,e,n,i,s,o,a,c,l){const h=this.elements;return h[0]=t,h[1]=i,h[2]=a,h[3]=e,h[4]=s,h[5]=c,h[6]=n,h[7]=o,h[8]=l,this}identity(){return this.set(1,0,0,0,1,0,0,0,1),this}copy(t){const e=this.elements,n=t.elements;return e[0]=n[0],e[1]=n[1],e[2]=n[2],e[3]=n[3],e[4]=n[4],e[5]=n[5],e[6]=n[6],e[7]=n[7],e[8]=n[8],this}extractBasis(t,e,n){return t.setFromMatrix3Column(this,0),e.setFromMatrix3Column(this,1),n.setFromMatrix3Column(this,2),this}setFromMatrix4(t){const e=t.elements;return this.set(e[0],e[4],e[8],e[1],e[5],e[9],e[2],e[6],e[10]),this}multiply(t){return this.multiplyMatrices(this,t)}premultiply(t){return this.multiplyMatrices(t,this)}multiplyMatrices(t,e){const n=t.elements,i=e.elements,s=this.elements,o=n[0],a=n[3],c=n[6],l=n[1],h=n[4],d=n[7],f=n[2],u=n[5],m=n[8],v=i[0],p=i[3],g=i[6],x=i[1],_=i[4],y=i[7],w=i[2],T=i[5],R=i[8];return s[0]=o*v+a*x+c*w,s[3]=o*p+a*_+c*T,s[6]=o*g+a*y+c*R,s[1]=l*v+h*x+d*w,s[4]=l*p+h*_+d*T,s[7]=l*g+h*y+d*R,s[2]=f*v+u*x+m*w,s[5]=f*p+u*_+m*T,s[8]=f*g+u*y+m*R,this}multiplyScalar(t){const e=this.elements;return e[0]*=t,e[3]*=t,e[6]*=t,e[1]*=t,e[4]*=t,e[7]*=t,e[2]*=t,e[5]*=t,e[8]*=t,this}determinant(){const t=this.elements,e=t[0],n=t[1],i=t[2],s=t[3],o=t[4],a=t[5],c=t[6],l=t[7],h=t[8];return e*o*h-e*a*l-n*s*h+n*a*c+i*s*l-i*o*c}invert(){const t=this.elements,e=t[0],n=t[1],i=t[2],s=t[3],o=t[4],a=t[5],c=t[6],l=t[7],h=t[8],d=h*o-a*l,f=a*c-h*s,u=l*s-o*c,m=e*d+n*f+i*u;if(m===0)return this.set(0,0,0,0,0,0,0,0,0);const v=1/m;return t[0]=d*v,t[1]=(i*l-h*n)*v,t[2]=(a*n-i*o)*v,t[3]=f*v,t[4]=(h*e-i*c)*v,t[5]=(i*s-a*e)*v,t[6]=u*v,t[7]=(n*c-l*e)*v,t[8]=(o*e-n*s)*v,this}transpose(){let t;const e=this.elements;return t=e[1],e[1]=e[3],e[3]=t,t=e[2],e[2]=e[6],e[6]=t,t=e[5],e[5]=e[7],e[7]=t,this}getNormalMatrix(t){return this.setFromMatrix4(t).invert().transpose()}transposeIntoArray(t){const e=this.elements;return t[0]=e[0],t[1]=e[3],t[2]=e[6],t[3]=e[1],t[4]=e[4],t[5]=e[7],t[6]=e[2],t[7]=e[5],t[8]=e[8],this}setUvTransform(t,e,n,i,s,o,a){const c=Math.cos(s),l=Math.sin(s);return this.set(n*c,n*l,-n*(c*o+l*a)+o+t,-i*l,i*c,-i*(-l*o+c*a)+a+e,0,0,1),this}scale(t,e){return this.premultiply(ma.makeScale(t,e)),this}rotate(t){return this.premultiply(ma.makeRotation(-t)),this}translate(t,e){return this.premultiply(ma.makeTranslation(t,e)),this}makeTranslation(t,e){return t.isVector2?this.set(1,0,t.x,0,1,t.y,0,0,1):this.set(1,0,t,0,1,e,0,0,1),this}makeRotation(t){const e=Math.cos(t),n=Math.sin(t);return this.set(e,-n,0,n,e,0,0,0,1),this}makeScale(t,e){return this.set(t,0,0,0,e,0,0,0,1),this}equals(t){const e=this.elements,n=t.elements;for(let i=0;i<9;i++)if(e[i]!==n[i])return!1;return!0}fromArray(t,e=0){for(let n=0;n<9;n++)this.elements[n]=t[n+e];return this}toArray(t=[],e=0){const n=this.elements;return t[e]=n[0],t[e+1]=n[1],t[e+2]=n[2],t[e+3]=n[3],t[e+4]=n[4],t[e+5]=n[5],t[e+6]=n[6],t[e+7]=n[7],t[e+8]=n[8],t}clone(){return new this.constructor().fromArray(this.elements)}}const ma=new Qt;function c0(r){for(let t=r.length-1;t>=0;--t)if(r[t]>=65535)return!0;return!1}function Lr(r){return document.createElementNS("http://www.w3.org/1999/xhtml",r)}function Yd(){const r=Lr("canvas");return r.style.display="block",r}const lh={};function ko(r){r in lh||(lh[r]=!0,console.warn(r))}function $d(r,t,e){return new Promise(function(n,i){function s(){switch(r.clientWaitSync(t,r.SYNC_FLUSH_COMMANDS_BIT,0)){case r.WAIT_FAILED:i();break;case r.TIMEOUT_EXPIRED:setTimeout(s,e);break;default:n()}}setTimeout(s,e)})}function Kd(r){const t=r.elements;t[2]=.5*t[2]+.5*t[3],t[6]=.5*t[6]+.5*t[7],t[10]=.5*t[10]+.5*t[11],t[14]=.5*t[14]+.5*t[15]}function Zd(r){const t=r.elements;t[11]===-1?(t[10]=-t[10]-1,t[14]=-t[14]):(t[10]=-t[10],t[14]=-t[14]+1)}const hh=new Qt().set(.8224621,.177538,0,.0331941,.9668058,0,.0170827,.0723974,.9105199),uh=new Qt().set(1.2249401,-.2249404,0,-.0420569,1.0420571,0,-.0196376,-.0786361,1.0982735),tr={[Hi]:{transfer:Bo,primaries:Oo,luminanceCoefficients:[.2126,.7152,.0722],toReference:r=>r,fromReference:r=>r},[Mn]:{transfer:Ee,primaries:Oo,luminanceCoefficients:[.2126,.7152,.0722],toReference:r=>r.convertSRGBToLinear(),fromReference:r=>r.convertLinearToSRGB()},[Qo]:{transfer:Bo,primaries:Ho,luminanceCoefficients:[.2289,.6917,.0793],toReference:r=>r.applyMatrix3(uh),fromReference:r=>r.applyMatrix3(hh)},[yl]:{transfer:Ee,primaries:Ho,luminanceCoefficients:[.2289,.6917,.0793],toReference:r=>r.convertSRGBToLinear().applyMatrix3(uh),fromReference:r=>r.applyMatrix3(hh).convertLinearToSRGB()}},Jd=new Set([Hi,Qo]),me={enabled:!0,_workingColorSpace:Hi,get workingColorSpace(){return this._workingColorSpace},set workingColorSpace(r){if(!Jd.has(r))throw new Error(`Unsupported working color space, "${r}".`);this._workingColorSpace=r},convert:function(r,t,e){if(this.enabled===!1||t===e||!t||!e)return r;const n=tr[t].toReference,i=tr[e].fromReference;return i(n(r))},fromWorkingColorSpace:function(r,t){return this.convert(r,this._workingColorSpace,t)},toWorkingColorSpace:function(r,t){return this.convert(r,t,this._workingColorSpace)},getPrimaries:function(r){return tr[r].primaries},getTransfer:function(r){return r===ui?Bo:tr[r].transfer},getLuminanceCoefficients:function(r,t=this._workingColorSpace){return r.fromArray(tr[t].luminanceCoefficients)}};function Ds(r){return r<.04045?r*.0773993808:Math.pow(r*.9478672986+.0521327014,2.4)}function ga(r){return r<.0031308?r*12.92:1.055*Math.pow(r,.41666)-.055}let ls;class Qd{static getDataURL(t){if(/^data:/i.test(t.src)||typeof HTMLCanvasElement>"u")return t.src;let e;if(t instanceof HTMLCanvasElement)e=t;else{ls===void 0&&(ls=Lr("canvas")),ls.width=t.width,ls.height=t.height;const n=ls.getContext("2d");t instanceof ImageData?n.putImageData(t,0,0):n.drawImage(t,0,0,t.width,t.height),e=ls}return e.width>2048||e.height>2048?(console.warn("THREE.ImageUtils.getDataURL: Image converted to jpg for performance reasons",t),e.toDataURL("image/jpeg",.6)):e.toDataURL("image/png")}static sRGBToLinear(t){if(typeof HTMLImageElement<"u"&&t instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&t instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&t instanceof ImageBitmap){const e=Lr("canvas");e.width=t.width,e.height=t.height;const n=e.getContext("2d");n.drawImage(t,0,0,t.width,t.height);const i=n.getImageData(0,0,t.width,t.height),s=i.data;for(let o=0;o<s.length;o++)s[o]=Ds(s[o]/255)*255;return n.putImageData(i,0,0),e}else if(t.data){const e=t.data.slice(0);for(let n=0;n<e.length;n++)e instanceof Uint8Array||e instanceof Uint8ClampedArray?e[n]=Math.floor(Ds(e[n]/255)*255):e[n]=Ds(e[n]);return{data:e,width:t.width,height:t.height}}else return console.warn("THREE.ImageUtils.sRGBToLinear(): Unsupported image type. No color space conversion applied."),t}}let tf=0;class l0{constructor(t=null){this.isSource=!0,Object.defineProperty(this,"id",{value:tf++}),this.uuid=$n(),this.data=t,this.dataReady=!0,this.version=0}set needsUpdate(t){t===!0&&this.version++}toJSON(t){const e=t===void 0||typeof t=="string";if(!e&&t.images[this.uuid]!==void 0)return t.images[this.uuid];const n={uuid:this.uuid,url:""},i=this.data;if(i!==null){let s;if(Array.isArray(i)){s=[];for(let o=0,a=i.length;o<a;o++)i[o].isDataTexture?s.push(va(i[o].image)):s.push(va(i[o]))}else s=va(i);n.url=s}return e||(t.images[this.uuid]=n),n}}function va(r){return typeof HTMLImageElement<"u"&&r instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&r instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&r instanceof ImageBitmap?Qd.getDataURL(r):r.data?{data:Array.from(r.data),width:r.width,height:r.height,type:r.data.constructor.name}:(console.warn("THREE.Texture: Unable to serialize Texture."),{})}let ef=0;class Ke extends Zs{constructor(t=Ke.DEFAULT_IMAGE,e=Ke.DEFAULT_MAPPING,n=is,i=is,s=bn,o=Di,a=Sn,c=ti,l=Ke.DEFAULT_ANISOTROPY,h=ui){super(),this.isTexture=!0,Object.defineProperty(this,"id",{value:ef++}),this.uuid=$n(),this.name="",this.source=new l0(t),this.mipmaps=[],this.mapping=e,this.channel=0,this.wrapS=n,this.wrapT=i,this.magFilter=s,this.minFilter=o,this.anisotropy=l,this.format=a,this.internalFormat=null,this.type=c,this.offset=new ct(0,0),this.repeat=new ct(1,1),this.center=new ct(0,0),this.rotation=0,this.matrixAutoUpdate=!0,this.matrix=new Qt,this.generateMipmaps=!0,this.premultiplyAlpha=!1,this.flipY=!0,this.unpackAlignment=4,this.colorSpace=h,this.userData={},this.version=0,this.onUpdate=null,this.isRenderTargetTexture=!1,this.pmremVersion=0}get image(){return this.source.data}set image(t=null){this.source.data=t}updateMatrix(){this.matrix.setUvTransform(this.offset.x,this.offset.y,this.repeat.x,this.repeat.y,this.rotation,this.center.x,this.center.y)}clone(){return new this.constructor().copy(this)}copy(t){return this.name=t.name,this.source=t.source,this.mipmaps=t.mipmaps.slice(0),this.mapping=t.mapping,this.channel=t.channel,this.wrapS=t.wrapS,this.wrapT=t.wrapT,this.magFilter=t.magFilter,this.minFilter=t.minFilter,this.anisotropy=t.anisotropy,this.format=t.format,this.internalFormat=t.internalFormat,this.type=t.type,this.offset.copy(t.offset),this.repeat.copy(t.repeat),this.center.copy(t.center),this.rotation=t.rotation,this.matrixAutoUpdate=t.matrixAutoUpdate,this.matrix.copy(t.matrix),this.generateMipmaps=t.generateMipmaps,this.premultiplyAlpha=t.premultiplyAlpha,this.flipY=t.flipY,this.unpackAlignment=t.unpackAlignment,this.colorSpace=t.colorSpace,this.userData=JSON.parse(JSON.stringify(t.userData)),this.needsUpdate=!0,this}toJSON(t){const e=t===void 0||typeof t=="string";if(!e&&t.textures[this.uuid]!==void 0)return t.textures[this.uuid];const n={metadata:{version:4.6,type:"Texture",generator:"Texture.toJSON"},uuid:this.uuid,name:this.name,image:this.source.toJSON(t).uuid,mapping:this.mapping,channel:this.channel,repeat:[this.repeat.x,this.repeat.y],offset:[this.offset.x,this.offset.y],center:[this.center.x,this.center.y],rotation:this.rotation,wrap:[this.wrapS,this.wrapT],format:this.format,internalFormat:this.internalFormat,type:this.type,colorSpace:this.colorSpace,minFilter:this.minFilter,magFilter:this.magFilter,anisotropy:this.anisotropy,flipY:this.flipY,generateMipmaps:this.generateMipmaps,premultiplyAlpha:this.premultiplyAlpha,unpackAlignment:this.unpackAlignment};return Object.keys(this.userData).length>0&&(n.userData=this.userData),e||(t.textures[this.uuid]=n),n}dispose(){this.dispatchEvent({type:"dispose"})}transformUv(t){if(this.mapping!==Zu)return t;if(t.applyMatrix3(this.matrix),t.x<0||t.x>1)switch(this.wrapS){case Fo:t.x=t.x-Math.floor(t.x);break;case is:t.x=t.x<0?0:1;break;case Ec:Math.abs(Math.floor(t.x)%2)===1?t.x=Math.ceil(t.x)-t.x:t.x=t.x-Math.floor(t.x);break}if(t.y<0||t.y>1)switch(this.wrapT){case Fo:t.y=t.y-Math.floor(t.y);break;case is:t.y=t.y<0?0:1;break;case Ec:Math.abs(Math.floor(t.y)%2)===1?t.y=Math.ceil(t.y)-t.y:t.y=t.y-Math.floor(t.y);break}return this.flipY&&(t.y=1-t.y),t}set needsUpdate(t){t===!0&&(this.version++,this.source.needsUpdate=!0)}set needsPMREMUpdate(t){t===!0&&this.pmremVersion++}}Ke.DEFAULT_IMAGE=null;Ke.DEFAULT_MAPPING=Zu;Ke.DEFAULT_ANISOTROPY=1;class we{constructor(t=0,e=0,n=0,i=1){we.prototype.isVector4=!0,this.x=t,this.y=e,this.z=n,this.w=i}get width(){return this.z}set width(t){this.z=t}get height(){return this.w}set height(t){this.w=t}set(t,e,n,i){return this.x=t,this.y=e,this.z=n,this.w=i,this}setScalar(t){return this.x=t,this.y=t,this.z=t,this.w=t,this}setX(t){return this.x=t,this}setY(t){return this.y=t,this}setZ(t){return this.z=t,this}setW(t){return this.w=t,this}setComponent(t,e){switch(t){case 0:this.x=e;break;case 1:this.y=e;break;case 2:this.z=e;break;case 3:this.w=e;break;default:throw new Error("index is out of range: "+t)}return this}getComponent(t){switch(t){case 0:return this.x;case 1:return this.y;case 2:return this.z;case 3:return this.w;default:throw new Error("index is out of range: "+t)}}clone(){return new this.constructor(this.x,this.y,this.z,this.w)}copy(t){return this.x=t.x,this.y=t.y,this.z=t.z,this.w=t.w!==void 0?t.w:1,this}add(t){return this.x+=t.x,this.y+=t.y,this.z+=t.z,this.w+=t.w,this}addScalar(t){return this.x+=t,this.y+=t,this.z+=t,this.w+=t,this}addVectors(t,e){return this.x=t.x+e.x,this.y=t.y+e.y,this.z=t.z+e.z,this.w=t.w+e.w,this}addScaledVector(t,e){return this.x+=t.x*e,this.y+=t.y*e,this.z+=t.z*e,this.w+=t.w*e,this}sub(t){return this.x-=t.x,this.y-=t.y,this.z-=t.z,this.w-=t.w,this}subScalar(t){return this.x-=t,this.y-=t,this.z-=t,this.w-=t,this}subVectors(t,e){return this.x=t.x-e.x,this.y=t.y-e.y,this.z=t.z-e.z,this.w=t.w-e.w,this}multiply(t){return this.x*=t.x,this.y*=t.y,this.z*=t.z,this.w*=t.w,this}multiplyScalar(t){return this.x*=t,this.y*=t,this.z*=t,this.w*=t,this}applyMatrix4(t){const e=this.x,n=this.y,i=this.z,s=this.w,o=t.elements;return this.x=o[0]*e+o[4]*n+o[8]*i+o[12]*s,this.y=o[1]*e+o[5]*n+o[9]*i+o[13]*s,this.z=o[2]*e+o[6]*n+o[10]*i+o[14]*s,this.w=o[3]*e+o[7]*n+o[11]*i+o[15]*s,this}divideScalar(t){return this.multiplyScalar(1/t)}setAxisAngleFromQuaternion(t){this.w=2*Math.acos(t.w);const e=Math.sqrt(1-t.w*t.w);return e<1e-4?(this.x=1,this.y=0,this.z=0):(this.x=t.x/e,this.y=t.y/e,this.z=t.z/e),this}setAxisAngleFromRotationMatrix(t){let e,n,i,s;const c=t.elements,l=c[0],h=c[4],d=c[8],f=c[1],u=c[5],m=c[9],v=c[2],p=c[6],g=c[10];if(Math.abs(h-f)<.01&&Math.abs(d-v)<.01&&Math.abs(m-p)<.01){if(Math.abs(h+f)<.1&&Math.abs(d+v)<.1&&Math.abs(m+p)<.1&&Math.abs(l+u+g-3)<.1)return this.set(1,0,0,0),this;e=Math.PI;const _=(l+1)/2,y=(u+1)/2,w=(g+1)/2,T=(h+f)/4,R=(d+v)/4,E=(m+p)/4;return _>y&&_>w?_<.01?(n=0,i=.707106781,s=.707106781):(n=Math.sqrt(_),i=T/n,s=R/n):y>w?y<.01?(n=.707106781,i=0,s=.707106781):(i=Math.sqrt(y),n=T/i,s=E/i):w<.01?(n=.707106781,i=.707106781,s=0):(s=Math.sqrt(w),n=R/s,i=E/s),this.set(n,i,s,e),this}let x=Math.sqrt((p-m)*(p-m)+(d-v)*(d-v)+(f-h)*(f-h));return Math.abs(x)<.001&&(x=1),this.x=(p-m)/x,this.y=(d-v)/x,this.z=(f-h)/x,this.w=Math.acos((l+u+g-1)/2),this}setFromMatrixPosition(t){const e=t.elements;return this.x=e[12],this.y=e[13],this.z=e[14],this.w=e[15],this}min(t){return this.x=Math.min(this.x,t.x),this.y=Math.min(this.y,t.y),this.z=Math.min(this.z,t.z),this.w=Math.min(this.w,t.w),this}max(t){return this.x=Math.max(this.x,t.x),this.y=Math.max(this.y,t.y),this.z=Math.max(this.z,t.z),this.w=Math.max(this.w,t.w),this}clamp(t,e){return this.x=Math.max(t.x,Math.min(e.x,this.x)),this.y=Math.max(t.y,Math.min(e.y,this.y)),this.z=Math.max(t.z,Math.min(e.z,this.z)),this.w=Math.max(t.w,Math.min(e.w,this.w)),this}clampScalar(t,e){return this.x=Math.max(t,Math.min(e,this.x)),this.y=Math.max(t,Math.min(e,this.y)),this.z=Math.max(t,Math.min(e,this.z)),this.w=Math.max(t,Math.min(e,this.w)),this}clampLength(t,e){const n=this.length();return this.divideScalar(n||1).multiplyScalar(Math.max(t,Math.min(e,n)))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this.z=Math.floor(this.z),this.w=Math.floor(this.w),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this.z=Math.ceil(this.z),this.w=Math.ceil(this.w),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this.z=Math.round(this.z),this.w=Math.round(this.w),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this.z=Math.trunc(this.z),this.w=Math.trunc(this.w),this}negate(){return this.x=-this.x,this.y=-this.y,this.z=-this.z,this.w=-this.w,this}dot(t){return this.x*t.x+this.y*t.y+this.z*t.z+this.w*t.w}lengthSq(){return this.x*this.x+this.y*this.y+this.z*this.z+this.w*this.w}length(){return Math.sqrt(this.x*this.x+this.y*this.y+this.z*this.z+this.w*this.w)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)+Math.abs(this.z)+Math.abs(this.w)}normalize(){return this.divideScalar(this.length()||1)}setLength(t){return this.normalize().multiplyScalar(t)}lerp(t,e){return this.x+=(t.x-this.x)*e,this.y+=(t.y-this.y)*e,this.z+=(t.z-this.z)*e,this.w+=(t.w-this.w)*e,this}lerpVectors(t,e,n){return this.x=t.x+(e.x-t.x)*n,this.y=t.y+(e.y-t.y)*n,this.z=t.z+(e.z-t.z)*n,this.w=t.w+(e.w-t.w)*n,this}equals(t){return t.x===this.x&&t.y===this.y&&t.z===this.z&&t.w===this.w}fromArray(t,e=0){return this.x=t[e],this.y=t[e+1],this.z=t[e+2],this.w=t[e+3],this}toArray(t=[],e=0){return t[e]=this.x,t[e+1]=this.y,t[e+2]=this.z,t[e+3]=this.w,t}fromBufferAttribute(t,e){return this.x=t.getX(e),this.y=t.getY(e),this.z=t.getZ(e),this.w=t.getW(e),this}random(){return this.x=Math.random(),this.y=Math.random(),this.z=Math.random(),this.w=Math.random(),this}*[Symbol.iterator](){yield this.x,yield this.y,yield this.z,yield this.w}}class nf extends Zs{constructor(t=1,e=1,n={}){super(),this.isRenderTarget=!0,this.width=t,this.height=e,this.depth=1,this.scissor=new we(0,0,t,e),this.scissorTest=!1,this.viewport=new we(0,0,t,e);const i={width:t,height:e,depth:1};n=Object.assign({generateMipmaps:!1,internalFormat:null,minFilter:bn,depthBuffer:!0,stencilBuffer:!1,resolveDepthBuffer:!0,resolveStencilBuffer:!0,depthTexture:null,samples:0,count:1},n);const s=new Ke(i,n.mapping,n.wrapS,n.wrapT,n.magFilter,n.minFilter,n.format,n.type,n.anisotropy,n.colorSpace);s.flipY=!1,s.generateMipmaps=n.generateMipmaps,s.internalFormat=n.internalFormat,this.textures=[];const o=n.count;for(let a=0;a<o;a++)this.textures[a]=s.clone(),this.textures[a].isRenderTargetTexture=!0;this.depthBuffer=n.depthBuffer,this.stencilBuffer=n.stencilBuffer,this.resolveDepthBuffer=n.resolveDepthBuffer,this.resolveStencilBuffer=n.resolveStencilBuffer,this.depthTexture=n.depthTexture,this.samples=n.samples}get texture(){return this.textures[0]}set texture(t){this.textures[0]=t}setSize(t,e,n=1){if(this.width!==t||this.height!==e||this.depth!==n){this.width=t,this.height=e,this.depth=n;for(let i=0,s=this.textures.length;i<s;i++)this.textures[i].image.width=t,this.textures[i].image.height=e,this.textures[i].image.depth=n;this.dispose()}this.viewport.set(0,0,t,e),this.scissor.set(0,0,t,e)}clone(){return new this.constructor().copy(this)}copy(t){this.width=t.width,this.height=t.height,this.depth=t.depth,this.scissor.copy(t.scissor),this.scissorTest=t.scissorTest,this.viewport.copy(t.viewport),this.textures.length=0;for(let n=0,i=t.textures.length;n<i;n++)this.textures[n]=t.textures[n].clone(),this.textures[n].isRenderTargetTexture=!0;const e=Object.assign({},t.texture.image);return this.texture.source=new l0(e),this.depthBuffer=t.depthBuffer,this.stencilBuffer=t.stencilBuffer,this.resolveDepthBuffer=t.resolveDepthBuffer,this.resolveStencilBuffer=t.resolveStencilBuffer,t.depthTexture!==null&&(this.depthTexture=t.depthTexture.clone()),this.samples=t.samples,this}dispose(){this.dispatchEvent({type:"dispose"})}}class ei extends nf{constructor(t=1,e=1,n={}){super(t,e,n),this.isWebGLRenderTarget=!0}}class h0 extends Ke{constructor(t=null,e=1,n=1,i=1){super(null),this.isDataArrayTexture=!0,this.image={data:t,width:e,height:n,depth:i},this.magFilter=en,this.minFilter=en,this.wrapR=is,this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1,this.layerUpdates=new Set}addLayerUpdate(t){this.layerUpdates.add(t)}clearLayerUpdates(){this.layerUpdates.clear()}}class sf extends Ke{constructor(t=null,e=1,n=1,i=1){super(null),this.isData3DTexture=!0,this.image={data:t,width:e,height:n,depth:i},this.magFilter=en,this.minFilter=en,this.wrapR=is,this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1}}class De{constructor(t=0,e=0,n=0,i=1){this.isQuaternion=!0,this._x=t,this._y=e,this._z=n,this._w=i}static slerpFlat(t,e,n,i,s,o,a){let c=n[i+0],l=n[i+1],h=n[i+2],d=n[i+3];const f=s[o+0],u=s[o+1],m=s[o+2],v=s[o+3];if(a===0){t[e+0]=c,t[e+1]=l,t[e+2]=h,t[e+3]=d;return}if(a===1){t[e+0]=f,t[e+1]=u,t[e+2]=m,t[e+3]=v;return}if(d!==v||c!==f||l!==u||h!==m){let p=1-a;const g=c*f+l*u+h*m+d*v,x=g>=0?1:-1,_=1-g*g;if(_>Number.EPSILON){const w=Math.sqrt(_),T=Math.atan2(w,g*x);p=Math.sin(p*T)/w,a=Math.sin(a*T)/w}const y=a*x;if(c=c*p+f*y,l=l*p+u*y,h=h*p+m*y,d=d*p+v*y,p===1-a){const w=1/Math.sqrt(c*c+l*l+h*h+d*d);c*=w,l*=w,h*=w,d*=w}}t[e]=c,t[e+1]=l,t[e+2]=h,t[e+3]=d}static multiplyQuaternionsFlat(t,e,n,i,s,o){const a=n[i],c=n[i+1],l=n[i+2],h=n[i+3],d=s[o],f=s[o+1],u=s[o+2],m=s[o+3];return t[e]=a*m+h*d+c*u-l*f,t[e+1]=c*m+h*f+l*d-a*u,t[e+2]=l*m+h*u+a*f-c*d,t[e+3]=h*m-a*d-c*f-l*u,t}get x(){return this._x}set x(t){this._x=t,this._onChangeCallback()}get y(){return this._y}set y(t){this._y=t,this._onChangeCallback()}get z(){return this._z}set z(t){this._z=t,this._onChangeCallback()}get w(){return this._w}set w(t){this._w=t,this._onChangeCallback()}set(t,e,n,i){return this._x=t,this._y=e,this._z=n,this._w=i,this._onChangeCallback(),this}clone(){return new this.constructor(this._x,this._y,this._z,this._w)}copy(t){return this._x=t.x,this._y=t.y,this._z=t.z,this._w=t.w,this._onChangeCallback(),this}setFromEuler(t,e=!0){const n=t._x,i=t._y,s=t._z,o=t._order,a=Math.cos,c=Math.sin,l=a(n/2),h=a(i/2),d=a(s/2),f=c(n/2),u=c(i/2),m=c(s/2);switch(o){case"XYZ":this._x=f*h*d+l*u*m,this._y=l*u*d-f*h*m,this._z=l*h*m+f*u*d,this._w=l*h*d-f*u*m;break;case"YXZ":this._x=f*h*d+l*u*m,this._y=l*u*d-f*h*m,this._z=l*h*m-f*u*d,this._w=l*h*d+f*u*m;break;case"ZXY":this._x=f*h*d-l*u*m,this._y=l*u*d+f*h*m,this._z=l*h*m+f*u*d,this._w=l*h*d-f*u*m;break;case"ZYX":this._x=f*h*d-l*u*m,this._y=l*u*d+f*h*m,this._z=l*h*m-f*u*d,this._w=l*h*d+f*u*m;break;case"YZX":this._x=f*h*d+l*u*m,this._y=l*u*d+f*h*m,this._z=l*h*m-f*u*d,this._w=l*h*d-f*u*m;break;case"XZY":this._x=f*h*d-l*u*m,this._y=l*u*d-f*h*m,this._z=l*h*m+f*u*d,this._w=l*h*d+f*u*m;break;default:console.warn("THREE.Quaternion: .setFromEuler() encountered an unknown order: "+o)}return e===!0&&this._onChangeCallback(),this}setFromAxisAngle(t,e){const n=e/2,i=Math.sin(n);return this._x=t.x*i,this._y=t.y*i,this._z=t.z*i,this._w=Math.cos(n),this._onChangeCallback(),this}setFromRotationMatrix(t){const e=t.elements,n=e[0],i=e[4],s=e[8],o=e[1],a=e[5],c=e[9],l=e[2],h=e[6],d=e[10],f=n+a+d;if(f>0){const u=.5/Math.sqrt(f+1);this._w=.25/u,this._x=(h-c)*u,this._y=(s-l)*u,this._z=(o-i)*u}else if(n>a&&n>d){const u=2*Math.sqrt(1+n-a-d);this._w=(h-c)/u,this._x=.25*u,this._y=(i+o)/u,this._z=(s+l)/u}else if(a>d){const u=2*Math.sqrt(1+a-n-d);this._w=(s-l)/u,this._x=(i+o)/u,this._y=.25*u,this._z=(c+h)/u}else{const u=2*Math.sqrt(1+d-n-a);this._w=(o-i)/u,this._x=(s+l)/u,this._y=(c+h)/u,this._z=.25*u}return this._onChangeCallback(),this}setFromUnitVectors(t,e){let n=t.dot(e)+1;return n<Number.EPSILON?(n=0,Math.abs(t.x)>Math.abs(t.z)?(this._x=-t.y,this._y=t.x,this._z=0,this._w=n):(this._x=0,this._y=-t.z,this._z=t.y,this._w=n)):(this._x=t.y*e.z-t.z*e.y,this._y=t.z*e.x-t.x*e.z,this._z=t.x*e.y-t.y*e.x,this._w=n),this.normalize()}angleTo(t){return 2*Math.acos(Math.abs(He(this.dot(t),-1,1)))}rotateTowards(t,e){const n=this.angleTo(t);if(n===0)return this;const i=Math.min(1,e/n);return this.slerp(t,i),this}identity(){return this.set(0,0,0,1)}invert(){return this.conjugate()}conjugate(){return this._x*=-1,this._y*=-1,this._z*=-1,this._onChangeCallback(),this}dot(t){return this._x*t._x+this._y*t._y+this._z*t._z+this._w*t._w}lengthSq(){return this._x*this._x+this._y*this._y+this._z*this._z+this._w*this._w}length(){return Math.sqrt(this._x*this._x+this._y*this._y+this._z*this._z+this._w*this._w)}normalize(){let t=this.length();return t===0?(this._x=0,this._y=0,this._z=0,this._w=1):(t=1/t,this._x=this._x*t,this._y=this._y*t,this._z=this._z*t,this._w=this._w*t),this._onChangeCallback(),this}multiply(t){return this.multiplyQuaternions(this,t)}premultiply(t){return this.multiplyQuaternions(t,this)}multiplyQuaternions(t,e){const n=t._x,i=t._y,s=t._z,o=t._w,a=e._x,c=e._y,l=e._z,h=e._w;return this._x=n*h+o*a+i*l-s*c,this._y=i*h+o*c+s*a-n*l,this._z=s*h+o*l+n*c-i*a,this._w=o*h-n*a-i*c-s*l,this._onChangeCallback(),this}slerp(t,e){if(e===0)return this;if(e===1)return this.copy(t);const n=this._x,i=this._y,s=this._z,o=this._w;let a=o*t._w+n*t._x+i*t._y+s*t._z;if(a<0?(this._w=-t._w,this._x=-t._x,this._y=-t._y,this._z=-t._z,a=-a):this.copy(t),a>=1)return this._w=o,this._x=n,this._y=i,this._z=s,this;const c=1-a*a;if(c<=Number.EPSILON){const u=1-e;return this._w=u*o+e*this._w,this._x=u*n+e*this._x,this._y=u*i+e*this._y,this._z=u*s+e*this._z,this.normalize(),this}const l=Math.sqrt(c),h=Math.atan2(l,a),d=Math.sin((1-e)*h)/l,f=Math.sin(e*h)/l;return this._w=o*d+this._w*f,this._x=n*d+this._x*f,this._y=i*d+this._y*f,this._z=s*d+this._z*f,this._onChangeCallback(),this}slerpQuaternions(t,e,n){return this.copy(t).slerp(e,n)}random(){const t=2*Math.PI*Math.random(),e=2*Math.PI*Math.random(),n=Math.random(),i=Math.sqrt(1-n),s=Math.sqrt(n);return this.set(i*Math.sin(t),i*Math.cos(t),s*Math.sin(e),s*Math.cos(e))}equals(t){return t._x===this._x&&t._y===this._y&&t._z===this._z&&t._w===this._w}fromArray(t,e=0){return this._x=t[e],this._y=t[e+1],this._z=t[e+2],this._w=t[e+3],this._onChangeCallback(),this}toArray(t=[],e=0){return t[e]=this._x,t[e+1]=this._y,t[e+2]=this._z,t[e+3]=this._w,t}fromBufferAttribute(t,e){return this._x=t.getX(e),this._y=t.getY(e),this._z=t.getZ(e),this._w=t.getW(e),this._onChangeCallback(),this}toJSON(){return this.toArray()}_onChange(t){return this._onChangeCallback=t,this}_onChangeCallback(){}*[Symbol.iterator](){yield this._x,yield this._y,yield this._z,yield this._w}}class A{constructor(t=0,e=0,n=0){A.prototype.isVector3=!0,this.x=t,this.y=e,this.z=n}set(t,e,n){return n===void 0&&(n=this.z),this.x=t,this.y=e,this.z=n,this}setScalar(t){return this.x=t,this.y=t,this.z=t,this}setX(t){return this.x=t,this}setY(t){return this.y=t,this}setZ(t){return this.z=t,this}setComponent(t,e){switch(t){case 0:this.x=e;break;case 1:this.y=e;break;case 2:this.z=e;break;default:throw new Error("index is out of range: "+t)}return this}getComponent(t){switch(t){case 0:return this.x;case 1:return this.y;case 2:return this.z;default:throw new Error("index is out of range: "+t)}}clone(){return new this.constructor(this.x,this.y,this.z)}copy(t){return this.x=t.x,this.y=t.y,this.z=t.z,this}add(t){return this.x+=t.x,this.y+=t.y,this.z+=t.z,this}addScalar(t){return this.x+=t,this.y+=t,this.z+=t,this}addVectors(t,e){return this.x=t.x+e.x,this.y=t.y+e.y,this.z=t.z+e.z,this}addScaledVector(t,e){return this.x+=t.x*e,this.y+=t.y*e,this.z+=t.z*e,this}sub(t){return this.x-=t.x,this.y-=t.y,this.z-=t.z,this}subScalar(t){return this.x-=t,this.y-=t,this.z-=t,this}subVectors(t,e){return this.x=t.x-e.x,this.y=t.y-e.y,this.z=t.z-e.z,this}multiply(t){return this.x*=t.x,this.y*=t.y,this.z*=t.z,this}multiplyScalar(t){return this.x*=t,this.y*=t,this.z*=t,this}multiplyVectors(t,e){return this.x=t.x*e.x,this.y=t.y*e.y,this.z=t.z*e.z,this}applyEuler(t){return this.applyQuaternion(dh.setFromEuler(t))}applyAxisAngle(t,e){return this.applyQuaternion(dh.setFromAxisAngle(t,e))}applyMatrix3(t){const e=this.x,n=this.y,i=this.z,s=t.elements;return this.x=s[0]*e+s[3]*n+s[6]*i,this.y=s[1]*e+s[4]*n+s[7]*i,this.z=s[2]*e+s[5]*n+s[8]*i,this}applyNormalMatrix(t){return this.applyMatrix3(t).normalize()}applyMatrix4(t){const e=this.x,n=this.y,i=this.z,s=t.elements,o=1/(s[3]*e+s[7]*n+s[11]*i+s[15]);return this.x=(s[0]*e+s[4]*n+s[8]*i+s[12])*o,this.y=(s[1]*e+s[5]*n+s[9]*i+s[13])*o,this.z=(s[2]*e+s[6]*n+s[10]*i+s[14])*o,this}applyQuaternion(t){const e=this.x,n=this.y,i=this.z,s=t.x,o=t.y,a=t.z,c=t.w,l=2*(o*i-a*n),h=2*(a*e-s*i),d=2*(s*n-o*e);return this.x=e+c*l+o*d-a*h,this.y=n+c*h+a*l-s*d,this.z=i+c*d+s*h-o*l,this}project(t){return this.applyMatrix4(t.matrixWorldInverse).applyMatrix4(t.projectionMatrix)}unproject(t){return this.applyMatrix4(t.projectionMatrixInverse).applyMatrix4(t.matrixWorld)}transformDirection(t){const e=this.x,n=this.y,i=this.z,s=t.elements;return this.x=s[0]*e+s[4]*n+s[8]*i,this.y=s[1]*e+s[5]*n+s[9]*i,this.z=s[2]*e+s[6]*n+s[10]*i,this.normalize()}divide(t){return this.x/=t.x,this.y/=t.y,this.z/=t.z,this}divideScalar(t){return this.multiplyScalar(1/t)}min(t){return this.x=Math.min(this.x,t.x),this.y=Math.min(this.y,t.y),this.z=Math.min(this.z,t.z),this}max(t){return this.x=Math.max(this.x,t.x),this.y=Math.max(this.y,t.y),this.z=Math.max(this.z,t.z),this}clamp(t,e){return this.x=Math.max(t.x,Math.min(e.x,this.x)),this.y=Math.max(t.y,Math.min(e.y,this.y)),this.z=Math.max(t.z,Math.min(e.z,this.z)),this}clampScalar(t,e){return this.x=Math.max(t,Math.min(e,this.x)),this.y=Math.max(t,Math.min(e,this.y)),this.z=Math.max(t,Math.min(e,this.z)),this}clampLength(t,e){const n=this.length();return this.divideScalar(n||1).multiplyScalar(Math.max(t,Math.min(e,n)))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this.z=Math.floor(this.z),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this.z=Math.ceil(this.z),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this.z=Math.round(this.z),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this.z=Math.trunc(this.z),this}negate(){return this.x=-this.x,this.y=-this.y,this.z=-this.z,this}dot(t){return this.x*t.x+this.y*t.y+this.z*t.z}lengthSq(){return this.x*this.x+this.y*this.y+this.z*this.z}length(){return Math.sqrt(this.x*this.x+this.y*this.y+this.z*this.z)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)+Math.abs(this.z)}normalize(){return this.divideScalar(this.length()||1)}setLength(t){return this.normalize().multiplyScalar(t)}lerp(t,e){return this.x+=(t.x-this.x)*e,this.y+=(t.y-this.y)*e,this.z+=(t.z-this.z)*e,this}lerpVectors(t,e,n){return this.x=t.x+(e.x-t.x)*n,this.y=t.y+(e.y-t.y)*n,this.z=t.z+(e.z-t.z)*n,this}cross(t){return this.crossVectors(this,t)}crossVectors(t,e){const n=t.x,i=t.y,s=t.z,o=e.x,a=e.y,c=e.z;return this.x=i*c-s*a,this.y=s*o-n*c,this.z=n*a-i*o,this}projectOnVector(t){const e=t.lengthSq();if(e===0)return this.set(0,0,0);const n=t.dot(this)/e;return this.copy(t).multiplyScalar(n)}projectOnPlane(t){return xa.copy(this).projectOnVector(t),this.sub(xa)}reflect(t){return this.sub(xa.copy(t).multiplyScalar(2*this.dot(t)))}angleTo(t){const e=Math.sqrt(this.lengthSq()*t.lengthSq());if(e===0)return Math.PI/2;const n=this.dot(t)/e;return Math.acos(He(n,-1,1))}distanceTo(t){return Math.sqrt(this.distanceToSquared(t))}distanceToSquared(t){const e=this.x-t.x,n=this.y-t.y,i=this.z-t.z;return e*e+n*n+i*i}manhattanDistanceTo(t){return Math.abs(this.x-t.x)+Math.abs(this.y-t.y)+Math.abs(this.z-t.z)}setFromSpherical(t){return this.setFromSphericalCoords(t.radius,t.phi,t.theta)}setFromSphericalCoords(t,e,n){const i=Math.sin(e)*t;return this.x=i*Math.sin(n),this.y=Math.cos(e)*t,this.z=i*Math.cos(n),this}setFromCylindrical(t){return this.setFromCylindricalCoords(t.radius,t.theta,t.y)}setFromCylindricalCoords(t,e,n){return this.x=t*Math.sin(e),this.y=n,this.z=t*Math.cos(e),this}setFromMatrixPosition(t){const e=t.elements;return this.x=e[12],this.y=e[13],this.z=e[14],this}setFromMatrixScale(t){const e=this.setFromMatrixColumn(t,0).length(),n=this.setFromMatrixColumn(t,1).length(),i=this.setFromMatrixColumn(t,2).length();return this.x=e,this.y=n,this.z=i,this}setFromMatrixColumn(t,e){return this.fromArray(t.elements,e*4)}setFromMatrix3Column(t,e){return this.fromArray(t.elements,e*3)}setFromEuler(t){return this.x=t._x,this.y=t._y,this.z=t._z,this}setFromColor(t){return this.x=t.r,this.y=t.g,this.z=t.b,this}equals(t){return t.x===this.x&&t.y===this.y&&t.z===this.z}fromArray(t,e=0){return this.x=t[e],this.y=t[e+1],this.z=t[e+2],this}toArray(t=[],e=0){return t[e]=this.x,t[e+1]=this.y,t[e+2]=this.z,t}fromBufferAttribute(t,e){return this.x=t.getX(e),this.y=t.getY(e),this.z=t.getZ(e),this}random(){return this.x=Math.random(),this.y=Math.random(),this.z=Math.random(),this}randomDirection(){const t=Math.random()*Math.PI*2,e=Math.random()*2-1,n=Math.sqrt(1-e*e);return this.x=n*Math.cos(t),this.y=e,this.z=n*Math.sin(t),this}*[Symbol.iterator](){yield this.x,yield this.y,yield this.z}}const xa=new A,dh=new De;class Vi{constructor(t=new A(1/0,1/0,1/0),e=new A(-1/0,-1/0,-1/0)){this.isBox3=!0,this.min=t,this.max=e}set(t,e){return this.min.copy(t),this.max.copy(e),this}setFromArray(t){this.makeEmpty();for(let e=0,n=t.length;e<n;e+=3)this.expandByPoint(In.fromArray(t,e));return this}setFromBufferAttribute(t){this.makeEmpty();for(let e=0,n=t.count;e<n;e++)this.expandByPoint(In.fromBufferAttribute(t,e));return this}setFromPoints(t){this.makeEmpty();for(let e=0,n=t.length;e<n;e++)this.expandByPoint(t[e]);return this}setFromCenterAndSize(t,e){const n=In.copy(e).multiplyScalar(.5);return this.min.copy(t).sub(n),this.max.copy(t).add(n),this}setFromObject(t,e=!1){return this.makeEmpty(),this.expandByObject(t,e)}clone(){return new this.constructor().copy(this)}copy(t){return this.min.copy(t.min),this.max.copy(t.max),this}makeEmpty(){return this.min.x=this.min.y=this.min.z=1/0,this.max.x=this.max.y=this.max.z=-1/0,this}isEmpty(){return this.max.x<this.min.x||this.max.y<this.min.y||this.max.z<this.min.z}getCenter(t){return this.isEmpty()?t.set(0,0,0):t.addVectors(this.min,this.max).multiplyScalar(.5)}getSize(t){return this.isEmpty()?t.set(0,0,0):t.subVectors(this.max,this.min)}expandByPoint(t){return this.min.min(t),this.max.max(t),this}expandByVector(t){return this.min.sub(t),this.max.add(t),this}expandByScalar(t){return this.min.addScalar(-t),this.max.addScalar(t),this}expandByObject(t,e=!1){t.updateWorldMatrix(!1,!1);const n=t.geometry;if(n!==void 0){const s=n.getAttribute("position");if(e===!0&&s!==void 0&&t.isInstancedMesh!==!0)for(let o=0,a=s.count;o<a;o++)t.isMesh===!0?t.getVertexPosition(o,In):In.fromBufferAttribute(s,o),In.applyMatrix4(t.matrixWorld),this.expandByPoint(In);else t.boundingBox!==void 0?(t.boundingBox===null&&t.computeBoundingBox(),Br.copy(t.boundingBox)):(n.boundingBox===null&&n.computeBoundingBox(),Br.copy(n.boundingBox)),Br.applyMatrix4(t.matrixWorld),this.union(Br)}const i=t.children;for(let s=0,o=i.length;s<o;s++)this.expandByObject(i[s],e);return this}containsPoint(t){return t.x>=this.min.x&&t.x<=this.max.x&&t.y>=this.min.y&&t.y<=this.max.y&&t.z>=this.min.z&&t.z<=this.max.z}containsBox(t){return this.min.x<=t.min.x&&t.max.x<=this.max.x&&this.min.y<=t.min.y&&t.max.y<=this.max.y&&this.min.z<=t.min.z&&t.max.z<=this.max.z}getParameter(t,e){return e.set((t.x-this.min.x)/(this.max.x-this.min.x),(t.y-this.min.y)/(this.max.y-this.min.y),(t.z-this.min.z)/(this.max.z-this.min.z))}intersectsBox(t){return t.max.x>=this.min.x&&t.min.x<=this.max.x&&t.max.y>=this.min.y&&t.min.y<=this.max.y&&t.max.z>=this.min.z&&t.min.z<=this.max.z}intersectsSphere(t){return this.clampPoint(t.center,In),In.distanceToSquared(t.center)<=t.radius*t.radius}intersectsPlane(t){let e,n;return t.normal.x>0?(e=t.normal.x*this.min.x,n=t.normal.x*this.max.x):(e=t.normal.x*this.max.x,n=t.normal.x*this.min.x),t.normal.y>0?(e+=t.normal.y*this.min.y,n+=t.normal.y*this.max.y):(e+=t.normal.y*this.max.y,n+=t.normal.y*this.min.y),t.normal.z>0?(e+=t.normal.z*this.min.z,n+=t.normal.z*this.max.z):(e+=t.normal.z*this.max.z,n+=t.normal.z*this.min.z),e<=-t.constant&&n>=-t.constant}intersectsTriangle(t){if(this.isEmpty())return!1;this.getCenter(er),Or.subVectors(this.max,er),hs.subVectors(t.a,er),us.subVectors(t.b,er),ds.subVectors(t.c,er),Mi.subVectors(us,hs),bi.subVectors(ds,us),Xi.subVectors(hs,ds);let e=[0,-Mi.z,Mi.y,0,-bi.z,bi.y,0,-Xi.z,Xi.y,Mi.z,0,-Mi.x,bi.z,0,-bi.x,Xi.z,0,-Xi.x,-Mi.y,Mi.x,0,-bi.y,bi.x,0,-Xi.y,Xi.x,0];return!_a(e,hs,us,ds,Or)||(e=[1,0,0,0,1,0,0,0,1],!_a(e,hs,us,ds,Or))?!1:(Hr.crossVectors(Mi,bi),e=[Hr.x,Hr.y,Hr.z],_a(e,hs,us,ds,Or))}clampPoint(t,e){return e.copy(t).clamp(this.min,this.max)}distanceToPoint(t){return this.clampPoint(t,In).distanceTo(t)}getBoundingSphere(t){return this.isEmpty()?t.makeEmpty():(this.getCenter(t.center),t.radius=this.getSize(In).length()*.5),t}intersect(t){return this.min.max(t.min),this.max.min(t.max),this.isEmpty()&&this.makeEmpty(),this}union(t){return this.min.min(t.min),this.max.max(t.max),this}applyMatrix4(t){return this.isEmpty()?this:(si[0].set(this.min.x,this.min.y,this.min.z).applyMatrix4(t),si[1].set(this.min.x,this.min.y,this.max.z).applyMatrix4(t),si[2].set(this.min.x,this.max.y,this.min.z).applyMatrix4(t),si[3].set(this.min.x,this.max.y,this.max.z).applyMatrix4(t),si[4].set(this.max.x,this.min.y,this.min.z).applyMatrix4(t),si[5].set(this.max.x,this.min.y,this.max.z).applyMatrix4(t),si[6].set(this.max.x,this.max.y,this.min.z).applyMatrix4(t),si[7].set(this.max.x,this.max.y,this.max.z).applyMatrix4(t),this.setFromPoints(si),this)}translate(t){return this.min.add(t),this.max.add(t),this}equals(t){return t.min.equals(this.min)&&t.max.equals(this.max)}}const si=[new A,new A,new A,new A,new A,new A,new A,new A],In=new A,Br=new Vi,hs=new A,us=new A,ds=new A,Mi=new A,bi=new A,Xi=new A,er=new A,Or=new A,Hr=new A,ji=new A;function _a(r,t,e,n,i){for(let s=0,o=r.length-3;s<=o;s+=3){ji.fromArray(r,s);const a=i.x*Math.abs(ji.x)+i.y*Math.abs(ji.y)+i.z*Math.abs(ji.z),c=t.dot(ji),l=e.dot(ji),h=n.dot(ji);if(Math.max(-Math.max(c,l,h),Math.min(c,l,h))>a)return!1}return!0}const rf=new Vi,nr=new A,ya=new A;class ni{constructor(t=new A,e=-1){this.isSphere=!0,this.center=t,this.radius=e}set(t,e){return this.center.copy(t),this.radius=e,this}setFromPoints(t,e){const n=this.center;e!==void 0?n.copy(e):rf.setFromPoints(t).getCenter(n);let i=0;for(let s=0,o=t.length;s<o;s++)i=Math.max(i,n.distanceToSquared(t[s]));return this.radius=Math.sqrt(i),this}copy(t){return this.center.copy(t.center),this.radius=t.radius,this}isEmpty(){return this.radius<0}makeEmpty(){return this.center.set(0,0,0),this.radius=-1,this}containsPoint(t){return t.distanceToSquared(this.center)<=this.radius*this.radius}distanceToPoint(t){return t.distanceTo(this.center)-this.radius}intersectsSphere(t){const e=this.radius+t.radius;return t.center.distanceToSquared(this.center)<=e*e}intersectsBox(t){return t.intersectsSphere(this)}intersectsPlane(t){return Math.abs(t.distanceToPoint(this.center))<=this.radius}clampPoint(t,e){const n=this.center.distanceToSquared(t);return e.copy(t),n>this.radius*this.radius&&(e.sub(this.center).normalize(),e.multiplyScalar(this.radius).add(this.center)),e}getBoundingBox(t){return this.isEmpty()?(t.makeEmpty(),t):(t.set(this.center,this.center),t.expandByScalar(this.radius),t)}applyMatrix4(t){return this.center.applyMatrix4(t),this.radius=this.radius*t.getMaxScaleOnAxis(),this}translate(t){return this.center.add(t),this}expandByPoint(t){if(this.isEmpty())return this.center.copy(t),this.radius=0,this;nr.subVectors(t,this.center);const e=nr.lengthSq();if(e>this.radius*this.radius){const n=Math.sqrt(e),i=(n-this.radius)*.5;this.center.addScaledVector(nr,i/n),this.radius+=i}return this}union(t){return t.isEmpty()?this:this.isEmpty()?(this.copy(t),this):(this.center.equals(t.center)===!0?this.radius=Math.max(this.radius,t.radius):(ya.subVectors(t.center,this.center).setLength(t.radius),this.expandByPoint(nr.copy(t.center).add(ya)),this.expandByPoint(nr.copy(t.center).sub(ya))),this)}equals(t){return t.center.equals(this.center)&&t.radius===this.radius}clone(){return new this.constructor().copy(this)}}const ri=new A,Ma=new A,Vr=new A,Si=new A,ba=new A,Gr=new A,Sa=new A;class ta{constructor(t=new A,e=new A(0,0,-1)){this.origin=t,this.direction=e}set(t,e){return this.origin.copy(t),this.direction.copy(e),this}copy(t){return this.origin.copy(t.origin),this.direction.copy(t.direction),this}at(t,e){return e.copy(this.origin).addScaledVector(this.direction,t)}lookAt(t){return this.direction.copy(t).sub(this.origin).normalize(),this}recast(t){return this.origin.copy(this.at(t,ri)),this}closestPointToPoint(t,e){e.subVectors(t,this.origin);const n=e.dot(this.direction);return n<0?e.copy(this.origin):e.copy(this.origin).addScaledVector(this.direction,n)}distanceToPoint(t){return Math.sqrt(this.distanceSqToPoint(t))}distanceSqToPoint(t){const e=ri.subVectors(t,this.origin).dot(this.direction);return e<0?this.origin.distanceToSquared(t):(ri.copy(this.origin).addScaledVector(this.direction,e),ri.distanceToSquared(t))}distanceSqToSegment(t,e,n,i){Ma.copy(t).add(e).multiplyScalar(.5),Vr.copy(e).sub(t).normalize(),Si.copy(this.origin).sub(Ma);const s=t.distanceTo(e)*.5,o=-this.direction.dot(Vr),a=Si.dot(this.direction),c=-Si.dot(Vr),l=Si.lengthSq(),h=Math.abs(1-o*o);let d,f,u,m;if(h>0)if(d=o*c-a,f=o*a-c,m=s*h,d>=0)if(f>=-m)if(f<=m){const v=1/h;d*=v,f*=v,u=d*(d+o*f+2*a)+f*(o*d+f+2*c)+l}else f=s,d=Math.max(0,-(o*f+a)),u=-d*d+f*(f+2*c)+l;else f=-s,d=Math.max(0,-(o*f+a)),u=-d*d+f*(f+2*c)+l;else f<=-m?(d=Math.max(0,-(-o*s+a)),f=d>0?-s:Math.min(Math.max(-s,-c),s),u=-d*d+f*(f+2*c)+l):f<=m?(d=0,f=Math.min(Math.max(-s,-c),s),u=f*(f+2*c)+l):(d=Math.max(0,-(o*s+a)),f=d>0?s:Math.min(Math.max(-s,-c),s),u=-d*d+f*(f+2*c)+l);else f=o>0?-s:s,d=Math.max(0,-(o*f+a)),u=-d*d+f*(f+2*c)+l;return n&&n.copy(this.origin).addScaledVector(this.direction,d),i&&i.copy(Ma).addScaledVector(Vr,f),u}intersectSphere(t,e){ri.subVectors(t.center,this.origin);const n=ri.dot(this.direction),i=ri.dot(ri)-n*n,s=t.radius*t.radius;if(i>s)return null;const o=Math.sqrt(s-i),a=n-o,c=n+o;return c<0?null:a<0?this.at(c,e):this.at(a,e)}intersectsSphere(t){return this.distanceSqToPoint(t.center)<=t.radius*t.radius}distanceToPlane(t){const e=t.normal.dot(this.direction);if(e===0)return t.distanceToPoint(this.origin)===0?0:null;const n=-(this.origin.dot(t.normal)+t.constant)/e;return n>=0?n:null}intersectPlane(t,e){const n=this.distanceToPlane(t);return n===null?null:this.at(n,e)}intersectsPlane(t){const e=t.distanceToPoint(this.origin);return e===0||t.normal.dot(this.direction)*e<0}intersectBox(t,e){let n,i,s,o,a,c;const l=1/this.direction.x,h=1/this.direction.y,d=1/this.direction.z,f=this.origin;return l>=0?(n=(t.min.x-f.x)*l,i=(t.max.x-f.x)*l):(n=(t.max.x-f.x)*l,i=(t.min.x-f.x)*l),h>=0?(s=(t.min.y-f.y)*h,o=(t.max.y-f.y)*h):(s=(t.max.y-f.y)*h,o=(t.min.y-f.y)*h),n>o||s>i||((s>n||isNaN(n))&&(n=s),(o<i||isNaN(i))&&(i=o),d>=0?(a=(t.min.z-f.z)*d,c=(t.max.z-f.z)*d):(a=(t.max.z-f.z)*d,c=(t.min.z-f.z)*d),n>c||a>i)||((a>n||n!==n)&&(n=a),(c<i||i!==i)&&(i=c),i<0)?null:this.at(n>=0?n:i,e)}intersectsBox(t){return this.intersectBox(t,ri)!==null}intersectTriangle(t,e,n,i,s){ba.subVectors(e,t),Gr.subVectors(n,t),Sa.crossVectors(ba,Gr);let o=this.direction.dot(Sa),a;if(o>0){if(i)return null;a=1}else if(o<0)a=-1,o=-o;else return null;Si.subVectors(this.origin,t);const c=a*this.direction.dot(Gr.crossVectors(Si,Gr));if(c<0)return null;const l=a*this.direction.dot(ba.cross(Si));if(l<0||c+l>o)return null;const h=-a*Si.dot(Sa);return h<0?null:this.at(h/o,s)}applyMatrix4(t){return this.origin.applyMatrix4(t),this.direction.transformDirection(t),this}equals(t){return t.origin.equals(this.origin)&&t.direction.equals(this.direction)}clone(){return new this.constructor().copy(this)}}class Dt{constructor(t,e,n,i,s,o,a,c,l,h,d,f,u,m,v,p){Dt.prototype.isMatrix4=!0,this.elements=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],t!==void 0&&this.set(t,e,n,i,s,o,a,c,l,h,d,f,u,m,v,p)}set(t,e,n,i,s,o,a,c,l,h,d,f,u,m,v,p){const g=this.elements;return g[0]=t,g[4]=e,g[8]=n,g[12]=i,g[1]=s,g[5]=o,g[9]=a,g[13]=c,g[2]=l,g[6]=h,g[10]=d,g[14]=f,g[3]=u,g[7]=m,g[11]=v,g[15]=p,this}identity(){return this.set(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1),this}clone(){return new Dt().fromArray(this.elements)}copy(t){const e=this.elements,n=t.elements;return e[0]=n[0],e[1]=n[1],e[2]=n[2],e[3]=n[3],e[4]=n[4],e[5]=n[5],e[6]=n[6],e[7]=n[7],e[8]=n[8],e[9]=n[9],e[10]=n[10],e[11]=n[11],e[12]=n[12],e[13]=n[13],e[14]=n[14],e[15]=n[15],this}copyPosition(t){const e=this.elements,n=t.elements;return e[12]=n[12],e[13]=n[13],e[14]=n[14],this}setFromMatrix3(t){const e=t.elements;return this.set(e[0],e[3],e[6],0,e[1],e[4],e[7],0,e[2],e[5],e[8],0,0,0,0,1),this}extractBasis(t,e,n){return t.setFromMatrixColumn(this,0),e.setFromMatrixColumn(this,1),n.setFromMatrixColumn(this,2),this}makeBasis(t,e,n){return this.set(t.x,e.x,n.x,0,t.y,e.y,n.y,0,t.z,e.z,n.z,0,0,0,0,1),this}extractRotation(t){const e=this.elements,n=t.elements,i=1/fs.setFromMatrixColumn(t,0).length(),s=1/fs.setFromMatrixColumn(t,1).length(),o=1/fs.setFromMatrixColumn(t,2).length();return e[0]=n[0]*i,e[1]=n[1]*i,e[2]=n[2]*i,e[3]=0,e[4]=n[4]*s,e[5]=n[5]*s,e[6]=n[6]*s,e[7]=0,e[8]=n[8]*o,e[9]=n[9]*o,e[10]=n[10]*o,e[11]=0,e[12]=0,e[13]=0,e[14]=0,e[15]=1,this}makeRotationFromEuler(t){const e=this.elements,n=t.x,i=t.y,s=t.z,o=Math.cos(n),a=Math.sin(n),c=Math.cos(i),l=Math.sin(i),h=Math.cos(s),d=Math.sin(s);if(t.order==="XYZ"){const f=o*h,u=o*d,m=a*h,v=a*d;e[0]=c*h,e[4]=-c*d,e[8]=l,e[1]=u+m*l,e[5]=f-v*l,e[9]=-a*c,e[2]=v-f*l,e[6]=m+u*l,e[10]=o*c}else if(t.order==="YXZ"){const f=c*h,u=c*d,m=l*h,v=l*d;e[0]=f+v*a,e[4]=m*a-u,e[8]=o*l,e[1]=o*d,e[5]=o*h,e[9]=-a,e[2]=u*a-m,e[6]=v+f*a,e[10]=o*c}else if(t.order==="ZXY"){const f=c*h,u=c*d,m=l*h,v=l*d;e[0]=f-v*a,e[4]=-o*d,e[8]=m+u*a,e[1]=u+m*a,e[5]=o*h,e[9]=v-f*a,e[2]=-o*l,e[6]=a,e[10]=o*c}else if(t.order==="ZYX"){const f=o*h,u=o*d,m=a*h,v=a*d;e[0]=c*h,e[4]=m*l-u,e[8]=f*l+v,e[1]=c*d,e[5]=v*l+f,e[9]=u*l-m,e[2]=-l,e[6]=a*c,e[10]=o*c}else if(t.order==="YZX"){const f=o*c,u=o*l,m=a*c,v=a*l;e[0]=c*h,e[4]=v-f*d,e[8]=m*d+u,e[1]=d,e[5]=o*h,e[9]=-a*h,e[2]=-l*h,e[6]=u*d+m,e[10]=f-v*d}else if(t.order==="XZY"){const f=o*c,u=o*l,m=a*c,v=a*l;e[0]=c*h,e[4]=-d,e[8]=l*h,e[1]=f*d+v,e[5]=o*h,e[9]=u*d-m,e[2]=m*d-u,e[6]=a*h,e[10]=v*d+f}return e[3]=0,e[7]=0,e[11]=0,e[12]=0,e[13]=0,e[14]=0,e[15]=1,this}makeRotationFromQuaternion(t){return this.compose(of,t,af)}lookAt(t,e,n){const i=this.elements;return vn.subVectors(t,e),vn.lengthSq()===0&&(vn.z=1),vn.normalize(),wi.crossVectors(n,vn),wi.lengthSq()===0&&(Math.abs(n.z)===1?vn.x+=1e-4:vn.z+=1e-4,vn.normalize(),wi.crossVectors(n,vn)),wi.normalize(),Wr.crossVectors(vn,wi),i[0]=wi.x,i[4]=Wr.x,i[8]=vn.x,i[1]=wi.y,i[5]=Wr.y,i[9]=vn.y,i[2]=wi.z,i[6]=Wr.z,i[10]=vn.z,this}multiply(t){return this.multiplyMatrices(this,t)}premultiply(t){return this.multiplyMatrices(t,this)}multiplyMatrices(t,e){const n=t.elements,i=e.elements,s=this.elements,o=n[0],a=n[4],c=n[8],l=n[12],h=n[1],d=n[5],f=n[9],u=n[13],m=n[2],v=n[6],p=n[10],g=n[14],x=n[3],_=n[7],y=n[11],w=n[15],T=i[0],R=i[4],E=i[8],D=i[12],M=i[1],S=i[5],k=i[9],N=i[13],z=i[2],H=i[6],L=i[10],V=i[14],O=i[3],P=i[7],B=i[11],G=i[15];return s[0]=o*T+a*M+c*z+l*O,s[4]=o*R+a*S+c*H+l*P,s[8]=o*E+a*k+c*L+l*B,s[12]=o*D+a*N+c*V+l*G,s[1]=h*T+d*M+f*z+u*O,s[5]=h*R+d*S+f*H+u*P,s[9]=h*E+d*k+f*L+u*B,s[13]=h*D+d*N+f*V+u*G,s[2]=m*T+v*M+p*z+g*O,s[6]=m*R+v*S+p*H+g*P,s[10]=m*E+v*k+p*L+g*B,s[14]=m*D+v*N+p*V+g*G,s[3]=x*T+_*M+y*z+w*O,s[7]=x*R+_*S+y*H+w*P,s[11]=x*E+_*k+y*L+w*B,s[15]=x*D+_*N+y*V+w*G,this}multiplyScalar(t){const e=this.elements;return e[0]*=t,e[4]*=t,e[8]*=t,e[12]*=t,e[1]*=t,e[5]*=t,e[9]*=t,e[13]*=t,e[2]*=t,e[6]*=t,e[10]*=t,e[14]*=t,e[3]*=t,e[7]*=t,e[11]*=t,e[15]*=t,this}determinant(){const t=this.elements,e=t[0],n=t[4],i=t[8],s=t[12],o=t[1],a=t[5],c=t[9],l=t[13],h=t[2],d=t[6],f=t[10],u=t[14],m=t[3],v=t[7],p=t[11],g=t[15];return m*(+s*c*d-i*l*d-s*a*f+n*l*f+i*a*u-n*c*u)+v*(+e*c*u-e*l*f+s*o*f-i*o*u+i*l*h-s*c*h)+p*(+e*l*d-e*a*u-s*o*d+n*o*u+s*a*h-n*l*h)+g*(-i*a*h-e*c*d+e*a*f+i*o*d-n*o*f+n*c*h)}transpose(){const t=this.elements;let e;return e=t[1],t[1]=t[4],t[4]=e,e=t[2],t[2]=t[8],t[8]=e,e=t[6],t[6]=t[9],t[9]=e,e=t[3],t[3]=t[12],t[12]=e,e=t[7],t[7]=t[13],t[13]=e,e=t[11],t[11]=t[14],t[14]=e,this}setPosition(t,e,n){const i=this.elements;return t.isVector3?(i[12]=t.x,i[13]=t.y,i[14]=t.z):(i[12]=t,i[13]=e,i[14]=n),this}invert(){const t=this.elements,e=t[0],n=t[1],i=t[2],s=t[3],o=t[4],a=t[5],c=t[6],l=t[7],h=t[8],d=t[9],f=t[10],u=t[11],m=t[12],v=t[13],p=t[14],g=t[15],x=d*p*l-v*f*l+v*c*u-a*p*u-d*c*g+a*f*g,_=m*f*l-h*p*l-m*c*u+o*p*u+h*c*g-o*f*g,y=h*v*l-m*d*l+m*a*u-o*v*u-h*a*g+o*d*g,w=m*d*c-h*v*c-m*a*f+o*v*f+h*a*p-o*d*p,T=e*x+n*_+i*y+s*w;if(T===0)return this.set(0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0);const R=1/T;return t[0]=x*R,t[1]=(v*f*s-d*p*s-v*i*u+n*p*u+d*i*g-n*f*g)*R,t[2]=(a*p*s-v*c*s+v*i*l-n*p*l-a*i*g+n*c*g)*R,t[3]=(d*c*s-a*f*s-d*i*l+n*f*l+a*i*u-n*c*u)*R,t[4]=_*R,t[5]=(h*p*s-m*f*s+m*i*u-e*p*u-h*i*g+e*f*g)*R,t[6]=(m*c*s-o*p*s-m*i*l+e*p*l+o*i*g-e*c*g)*R,t[7]=(o*f*s-h*c*s+h*i*l-e*f*l-o*i*u+e*c*u)*R,t[8]=y*R,t[9]=(m*d*s-h*v*s-m*n*u+e*v*u+h*n*g-e*d*g)*R,t[10]=(o*v*s-m*a*s+m*n*l-e*v*l-o*n*g+e*a*g)*R,t[11]=(h*a*s-o*d*s-h*n*l+e*d*l+o*n*u-e*a*u)*R,t[12]=w*R,t[13]=(h*v*i-m*d*i+m*n*f-e*v*f-h*n*p+e*d*p)*R,t[14]=(m*a*i-o*v*i-m*n*c+e*v*c+o*n*p-e*a*p)*R,t[15]=(o*d*i-h*a*i+h*n*c-e*d*c-o*n*f+e*a*f)*R,this}scale(t){const e=this.elements,n=t.x,i=t.y,s=t.z;return e[0]*=n,e[4]*=i,e[8]*=s,e[1]*=n,e[5]*=i,e[9]*=s,e[2]*=n,e[6]*=i,e[10]*=s,e[3]*=n,e[7]*=i,e[11]*=s,this}getMaxScaleOnAxis(){const t=this.elements,e=t[0]*t[0]+t[1]*t[1]+t[2]*t[2],n=t[4]*t[4]+t[5]*t[5]+t[6]*t[6],i=t[8]*t[8]+t[9]*t[9]+t[10]*t[10];return Math.sqrt(Math.max(e,n,i))}makeTranslation(t,e,n){return t.isVector3?this.set(1,0,0,t.x,0,1,0,t.y,0,0,1,t.z,0,0,0,1):this.set(1,0,0,t,0,1,0,e,0,0,1,n,0,0,0,1),this}makeRotationX(t){const e=Math.cos(t),n=Math.sin(t);return this.set(1,0,0,0,0,e,-n,0,0,n,e,0,0,0,0,1),this}makeRotationY(t){const e=Math.cos(t),n=Math.sin(t);return this.set(e,0,n,0,0,1,0,0,-n,0,e,0,0,0,0,1),this}makeRotationZ(t){const e=Math.cos(t),n=Math.sin(t);return this.set(e,-n,0,0,n,e,0,0,0,0,1,0,0,0,0,1),this}makeRotationAxis(t,e){const n=Math.cos(e),i=Math.sin(e),s=1-n,o=t.x,a=t.y,c=t.z,l=s*o,h=s*a;return this.set(l*o+n,l*a-i*c,l*c+i*a,0,l*a+i*c,h*a+n,h*c-i*o,0,l*c-i*a,h*c+i*o,s*c*c+n,0,0,0,0,1),this}makeScale(t,e,n){return this.set(t,0,0,0,0,e,0,0,0,0,n,0,0,0,0,1),this}makeShear(t,e,n,i,s,o){return this.set(1,n,s,0,t,1,o,0,e,i,1,0,0,0,0,1),this}compose(t,e,n){const i=this.elements,s=e._x,o=e._y,a=e._z,c=e._w,l=s+s,h=o+o,d=a+a,f=s*l,u=s*h,m=s*d,v=o*h,p=o*d,g=a*d,x=c*l,_=c*h,y=c*d,w=n.x,T=n.y,R=n.z;return i[0]=(1-(v+g))*w,i[1]=(u+y)*w,i[2]=(m-_)*w,i[3]=0,i[4]=(u-y)*T,i[5]=(1-(f+g))*T,i[6]=(p+x)*T,i[7]=0,i[8]=(m+_)*R,i[9]=(p-x)*R,i[10]=(1-(f+v))*R,i[11]=0,i[12]=t.x,i[13]=t.y,i[14]=t.z,i[15]=1,this}decompose(t,e,n){const i=this.elements;let s=fs.set(i[0],i[1],i[2]).length();const o=fs.set(i[4],i[5],i[6]).length(),a=fs.set(i[8],i[9],i[10]).length();this.determinant()<0&&(s=-s),t.x=i[12],t.y=i[13],t.z=i[14],Nn.copy(this);const l=1/s,h=1/o,d=1/a;return Nn.elements[0]*=l,Nn.elements[1]*=l,Nn.elements[2]*=l,Nn.elements[4]*=h,Nn.elements[5]*=h,Nn.elements[6]*=h,Nn.elements[8]*=d,Nn.elements[9]*=d,Nn.elements[10]*=d,e.setFromRotationMatrix(Nn),n.x=s,n.y=o,n.z=a,this}makePerspective(t,e,n,i,s,o,a=di){const c=this.elements,l=2*s/(e-t),h=2*s/(n-i),d=(e+t)/(e-t),f=(n+i)/(n-i);let u,m;if(a===di)u=-(o+s)/(o-s),m=-2*o*s/(o-s);else if(a===Vo)u=-o/(o-s),m=-o*s/(o-s);else throw new Error("THREE.Matrix4.makePerspective(): Invalid coordinate system: "+a);return c[0]=l,c[4]=0,c[8]=d,c[12]=0,c[1]=0,c[5]=h,c[9]=f,c[13]=0,c[2]=0,c[6]=0,c[10]=u,c[14]=m,c[3]=0,c[7]=0,c[11]=-1,c[15]=0,this}makeOrthographic(t,e,n,i,s,o,a=di){const c=this.elements,l=1/(e-t),h=1/(n-i),d=1/(o-s),f=(e+t)*l,u=(n+i)*h;let m,v;if(a===di)m=(o+s)*d,v=-2*d;else if(a===Vo)m=s*d,v=-1*d;else throw new Error("THREE.Matrix4.makeOrthographic(): Invalid coordinate system: "+a);return c[0]=2*l,c[4]=0,c[8]=0,c[12]=-f,c[1]=0,c[5]=2*h,c[9]=0,c[13]=-u,c[2]=0,c[6]=0,c[10]=v,c[14]=-m,c[3]=0,c[7]=0,c[11]=0,c[15]=1,this}equals(t){const e=this.elements,n=t.elements;for(let i=0;i<16;i++)if(e[i]!==n[i])return!1;return!0}fromArray(t,e=0){for(let n=0;n<16;n++)this.elements[n]=t[n+e];return this}toArray(t=[],e=0){const n=this.elements;return t[e]=n[0],t[e+1]=n[1],t[e+2]=n[2],t[e+3]=n[3],t[e+4]=n[4],t[e+5]=n[5],t[e+6]=n[6],t[e+7]=n[7],t[e+8]=n[8],t[e+9]=n[9],t[e+10]=n[10],t[e+11]=n[11],t[e+12]=n[12],t[e+13]=n[13],t[e+14]=n[14],t[e+15]=n[15],t}}const fs=new A,Nn=new Dt,of=new A(0,0,0),af=new A(1,1,1),wi=new A,Wr=new A,vn=new A,fh=new Dt,ph=new De;class Ve{constructor(t=0,e=0,n=0,i=Ve.DEFAULT_ORDER){this.isEuler=!0,this._x=t,this._y=e,this._z=n,this._order=i}get x(){return this._x}set x(t){this._x=t,this._onChangeCallback()}get y(){return this._y}set y(t){this._y=t,this._onChangeCallback()}get z(){return this._z}set z(t){this._z=t,this._onChangeCallback()}get order(){return this._order}set order(t){this._order=t,this._onChangeCallback()}set(t,e,n,i=this._order){return this._x=t,this._y=e,this._z=n,this._order=i,this._onChangeCallback(),this}clone(){return new this.constructor(this._x,this._y,this._z,this._order)}copy(t){return this._x=t._x,this._y=t._y,this._z=t._z,this._order=t._order,this._onChangeCallback(),this}setFromRotationMatrix(t,e=this._order,n=!0){const i=t.elements,s=i[0],o=i[4],a=i[8],c=i[1],l=i[5],h=i[9],d=i[2],f=i[6],u=i[10];switch(e){case"XYZ":this._y=Math.asin(He(a,-1,1)),Math.abs(a)<.9999999?(this._x=Math.atan2(-h,u),this._z=Math.atan2(-o,s)):(this._x=Math.atan2(f,l),this._z=0);break;case"YXZ":this._x=Math.asin(-He(h,-1,1)),Math.abs(h)<.9999999?(this._y=Math.atan2(a,u),this._z=Math.atan2(c,l)):(this._y=Math.atan2(-d,s),this._z=0);break;case"ZXY":this._x=Math.asin(He(f,-1,1)),Math.abs(f)<.9999999?(this._y=Math.atan2(-d,u),this._z=Math.atan2(-o,l)):(this._y=0,this._z=Math.atan2(c,s));break;case"ZYX":this._y=Math.asin(-He(d,-1,1)),Math.abs(d)<.9999999?(this._x=Math.atan2(f,u),this._z=Math.atan2(c,s)):(this._x=0,this._z=Math.atan2(-o,l));break;case"YZX":this._z=Math.asin(He(c,-1,1)),Math.abs(c)<.9999999?(this._x=Math.atan2(-h,l),this._y=Math.atan2(-d,s)):(this._x=0,this._y=Math.atan2(a,u));break;case"XZY":this._z=Math.asin(-He(o,-1,1)),Math.abs(o)<.9999999?(this._x=Math.atan2(f,l),this._y=Math.atan2(a,s)):(this._x=Math.atan2(-h,u),this._y=0);break;default:console.warn("THREE.Euler: .setFromRotationMatrix() encountered an unknown order: "+e)}return this._order=e,n===!0&&this._onChangeCallback(),this}setFromQuaternion(t,e,n){return fh.makeRotationFromQuaternion(t),this.setFromRotationMatrix(fh,e,n)}setFromVector3(t,e=this._order){return this.set(t.x,t.y,t.z,e)}reorder(t){return ph.setFromEuler(this),this.setFromQuaternion(ph,t)}equals(t){return t._x===this._x&&t._y===this._y&&t._z===this._z&&t._order===this._order}fromArray(t){return this._x=t[0],this._y=t[1],this._z=t[2],t[3]!==void 0&&(this._order=t[3]),this._onChangeCallback(),this}toArray(t=[],e=0){return t[e]=this._x,t[e+1]=this._y,t[e+2]=this._z,t[e+3]=this._order,t}_onChange(t){return this._onChangeCallback=t,this}_onChangeCallback(){}*[Symbol.iterator](){yield this._x,yield this._y,yield this._z,yield this._order}}Ve.DEFAULT_ORDER="XYZ";class u0{constructor(){this.mask=1}set(t){this.mask=(1<<t|0)>>>0}enable(t){this.mask|=1<<t|0}enableAll(){this.mask=-1}toggle(t){this.mask^=1<<t|0}disable(t){this.mask&=~(1<<t|0)}disableAll(){this.mask=0}test(t){return(this.mask&t.mask)!==0}isEnabled(t){return(this.mask&(1<<t|0))!==0}}let cf=0;const mh=new A,ps=new De,oi=new Dt,qr=new A,ir=new A,lf=new A,hf=new De,gh=new A(1,0,0),vh=new A(0,1,0),xh=new A(0,0,1),_h={type:"added"},uf={type:"removed"},ms={type:"childadded",child:null},wa={type:"childremoved",child:null};class _e extends Zs{constructor(){super(),this.isObject3D=!0,Object.defineProperty(this,"id",{value:cf++}),this.uuid=$n(),this.name="",this.type="Object3D",this.parent=null,this.children=[],this.up=_e.DEFAULT_UP.clone();const t=new A,e=new Ve,n=new De,i=new A(1,1,1);function s(){n.setFromEuler(e,!1)}function o(){e.setFromQuaternion(n,void 0,!1)}e._onChange(s),n._onChange(o),Object.defineProperties(this,{position:{configurable:!0,enumerable:!0,value:t},rotation:{configurable:!0,enumerable:!0,value:e},quaternion:{configurable:!0,enumerable:!0,value:n},scale:{configurable:!0,enumerable:!0,value:i},modelViewMatrix:{value:new Dt},normalMatrix:{value:new Qt}}),this.matrix=new Dt,this.matrixWorld=new Dt,this.matrixAutoUpdate=_e.DEFAULT_MATRIX_AUTO_UPDATE,this.matrixWorldAutoUpdate=_e.DEFAULT_MATRIX_WORLD_AUTO_UPDATE,this.matrixWorldNeedsUpdate=!1,this.layers=new u0,this.visible=!0,this.castShadow=!1,this.receiveShadow=!1,this.frustumCulled=!0,this.renderOrder=0,this.animations=[],this.userData={}}onBeforeShadow(){}onAfterShadow(){}onBeforeRender(){}onAfterRender(){}applyMatrix4(t){this.matrixAutoUpdate&&this.updateMatrix(),this.matrix.premultiply(t),this.matrix.decompose(this.position,this.quaternion,this.scale)}applyQuaternion(t){return this.quaternion.premultiply(t),this}setRotationFromAxisAngle(t,e){this.quaternion.setFromAxisAngle(t,e)}setRotationFromEuler(t){this.quaternion.setFromEuler(t,!0)}setRotationFromMatrix(t){this.quaternion.setFromRotationMatrix(t)}setRotationFromQuaternion(t){this.quaternion.copy(t)}rotateOnAxis(t,e){return ps.setFromAxisAngle(t,e),this.quaternion.multiply(ps),this}rotateOnWorldAxis(t,e){return ps.setFromAxisAngle(t,e),this.quaternion.premultiply(ps),this}rotateX(t){return this.rotateOnAxis(gh,t)}rotateY(t){return this.rotateOnAxis(vh,t)}rotateZ(t){return this.rotateOnAxis(xh,t)}translateOnAxis(t,e){return mh.copy(t).applyQuaternion(this.quaternion),this.position.add(mh.multiplyScalar(e)),this}translateX(t){return this.translateOnAxis(gh,t)}translateY(t){return this.translateOnAxis(vh,t)}translateZ(t){return this.translateOnAxis(xh,t)}localToWorld(t){return this.updateWorldMatrix(!0,!1),t.applyMatrix4(this.matrixWorld)}worldToLocal(t){return this.updateWorldMatrix(!0,!1),t.applyMatrix4(oi.copy(this.matrixWorld).invert())}lookAt(t,e,n){t.isVector3?qr.copy(t):qr.set(t,e,n);const i=this.parent;this.updateWorldMatrix(!0,!1),ir.setFromMatrixPosition(this.matrixWorld),this.isCamera||this.isLight?oi.lookAt(ir,qr,this.up):oi.lookAt(qr,ir,this.up),this.quaternion.setFromRotationMatrix(oi),i&&(oi.extractRotation(i.matrixWorld),ps.setFromRotationMatrix(oi),this.quaternion.premultiply(ps.invert()))}add(t){if(arguments.length>1){for(let e=0;e<arguments.length;e++)this.add(arguments[e]);return this}return t===this?(console.error("THREE.Object3D.add: object can't be added as a child of itself.",t),this):(t&&t.isObject3D?(t.removeFromParent(),t.parent=this,this.children.push(t),t.dispatchEvent(_h),ms.child=t,this.dispatchEvent(ms),ms.child=null):console.error("THREE.Object3D.add: object not an instance of THREE.Object3D.",t),this)}remove(t){if(arguments.length>1){for(let n=0;n<arguments.length;n++)this.remove(arguments[n]);return this}const e=this.children.indexOf(t);return e!==-1&&(t.parent=null,this.children.splice(e,1),t.dispatchEvent(uf),wa.child=t,this.dispatchEvent(wa),wa.child=null),this}removeFromParent(){const t=this.parent;return t!==null&&t.remove(this),this}clear(){return this.remove(...this.children)}attach(t){return this.updateWorldMatrix(!0,!1),oi.copy(this.matrixWorld).invert(),t.parent!==null&&(t.parent.updateWorldMatrix(!0,!1),oi.multiply(t.parent.matrixWorld)),t.applyMatrix4(oi),t.removeFromParent(),t.parent=this,this.children.push(t),t.updateWorldMatrix(!1,!0),t.dispatchEvent(_h),ms.child=t,this.dispatchEvent(ms),ms.child=null,this}getObjectById(t){return this.getObjectByProperty("id",t)}getObjectByName(t){return this.getObjectByProperty("name",t)}getObjectByProperty(t,e){if(this[t]===e)return this;for(let n=0,i=this.children.length;n<i;n++){const o=this.children[n].getObjectByProperty(t,e);if(o!==void 0)return o}}getObjectsByProperty(t,e,n=[]){this[t]===e&&n.push(this);const i=this.children;for(let s=0,o=i.length;s<o;s++)i[s].getObjectsByProperty(t,e,n);return n}getWorldPosition(t){return this.updateWorldMatrix(!0,!1),t.setFromMatrixPosition(this.matrixWorld)}getWorldQuaternion(t){return this.updateWorldMatrix(!0,!1),this.matrixWorld.decompose(ir,t,lf),t}getWorldScale(t){return this.updateWorldMatrix(!0,!1),this.matrixWorld.decompose(ir,hf,t),t}getWorldDirection(t){this.updateWorldMatrix(!0,!1);const e=this.matrixWorld.elements;return t.set(e[8],e[9],e[10]).normalize()}raycast(){}traverse(t){t(this);const e=this.children;for(let n=0,i=e.length;n<i;n++)e[n].traverse(t)}traverseVisible(t){if(this.visible===!1)return;t(this);const e=this.children;for(let n=0,i=e.length;n<i;n++)e[n].traverseVisible(t)}traverseAncestors(t){const e=this.parent;e!==null&&(t(e),e.traverseAncestors(t))}updateMatrix(){this.matrix.compose(this.position,this.quaternion,this.scale),this.matrixWorldNeedsUpdate=!0}updateMatrixWorld(t){this.matrixAutoUpdate&&this.updateMatrix(),(this.matrixWorldNeedsUpdate||t)&&(this.matrixWorldAutoUpdate===!0&&(this.parent===null?this.matrixWorld.copy(this.matrix):this.matrixWorld.multiplyMatrices(this.parent.matrixWorld,this.matrix)),this.matrixWorldNeedsUpdate=!1,t=!0);const e=this.children;for(let n=0,i=e.length;n<i;n++)e[n].updateMatrixWorld(t)}updateWorldMatrix(t,e){const n=this.parent;if(t===!0&&n!==null&&n.updateWorldMatrix(!0,!1),this.matrixAutoUpdate&&this.updateMatrix(),this.matrixWorldAutoUpdate===!0&&(this.parent===null?this.matrixWorld.copy(this.matrix):this.matrixWorld.multiplyMatrices(this.parent.matrixWorld,this.matrix)),e===!0){const i=this.children;for(let s=0,o=i.length;s<o;s++)i[s].updateWorldMatrix(!1,!0)}}toJSON(t){const e=t===void 0||typeof t=="string",n={};e&&(t={geometries:{},materials:{},textures:{},images:{},shapes:{},skeletons:{},animations:{},nodes:{}},n.metadata={version:4.6,type:"Object",generator:"Object3D.toJSON"});const i={};i.uuid=this.uuid,i.type=this.type,this.name!==""&&(i.name=this.name),this.castShadow===!0&&(i.castShadow=!0),this.receiveShadow===!0&&(i.receiveShadow=!0),this.visible===!1&&(i.visible=!1),this.frustumCulled===!1&&(i.frustumCulled=!1),this.renderOrder!==0&&(i.renderOrder=this.renderOrder),Object.keys(this.userData).length>0&&(i.userData=this.userData),i.layers=this.layers.mask,i.matrix=this.matrix.toArray(),i.up=this.up.toArray(),this.matrixAutoUpdate===!1&&(i.matrixAutoUpdate=!1),this.isInstancedMesh&&(i.type="InstancedMesh",i.count=this.count,i.instanceMatrix=this.instanceMatrix.toJSON(),this.instanceColor!==null&&(i.instanceColor=this.instanceColor.toJSON())),this.isBatchedMesh&&(i.type="BatchedMesh",i.perObjectFrustumCulled=this.perObjectFrustumCulled,i.sortObjects=this.sortObjects,i.drawRanges=this._drawRanges,i.reservedRanges=this._reservedRanges,i.visibility=this._visibility,i.active=this._active,i.bounds=this._bounds.map(a=>({boxInitialized:a.boxInitialized,boxMin:a.box.min.toArray(),boxMax:a.box.max.toArray(),sphereInitialized:a.sphereInitialized,sphereRadius:a.sphere.radius,sphereCenter:a.sphere.center.toArray()})),i.maxInstanceCount=this._maxInstanceCount,i.maxVertexCount=this._maxVertexCount,i.maxIndexCount=this._maxIndexCount,i.geometryInitialized=this._geometryInitialized,i.geometryCount=this._geometryCount,i.matricesTexture=this._matricesTexture.toJSON(t),this._colorsTexture!==null&&(i.colorsTexture=this._colorsTexture.toJSON(t)),this.boundingSphere!==null&&(i.boundingSphere={center:i.boundingSphere.center.toArray(),radius:i.boundingSphere.radius}),this.boundingBox!==null&&(i.boundingBox={min:i.boundingBox.min.toArray(),max:i.boundingBox.max.toArray()}));function s(a,c){return a[c.uuid]===void 0&&(a[c.uuid]=c.toJSON(t)),c.uuid}if(this.isScene)this.background&&(this.background.isColor?i.background=this.background.toJSON():this.background.isTexture&&(i.background=this.background.toJSON(t).uuid)),this.environment&&this.environment.isTexture&&this.environment.isRenderTargetTexture!==!0&&(i.environment=this.environment.toJSON(t).uuid);else if(this.isMesh||this.isLine||this.isPoints){i.geometry=s(t.geometries,this.geometry);const a=this.geometry.parameters;if(a!==void 0&&a.shapes!==void 0){const c=a.shapes;if(Array.isArray(c))for(let l=0,h=c.length;l<h;l++){const d=c[l];s(t.shapes,d)}else s(t.shapes,c)}}if(this.isSkinnedMesh&&(i.bindMode=this.bindMode,i.bindMatrix=this.bindMatrix.toArray(),this.skeleton!==void 0&&(s(t.skeletons,this.skeleton),i.skeleton=this.skeleton.uuid)),this.material!==void 0)if(Array.isArray(this.material)){const a=[];for(let c=0,l=this.material.length;c<l;c++)a.push(s(t.materials,this.material[c]));i.material=a}else i.material=s(t.materials,this.material);if(this.children.length>0){i.children=[];for(let a=0;a<this.children.length;a++)i.children.push(this.children[a].toJSON(t).object)}if(this.animations.length>0){i.animations=[];for(let a=0;a<this.animations.length;a++){const c=this.animations[a];i.animations.push(s(t.animations,c))}}if(e){const a=o(t.geometries),c=o(t.materials),l=o(t.textures),h=o(t.images),d=o(t.shapes),f=o(t.skeletons),u=o(t.animations),m=o(t.nodes);a.length>0&&(n.geometries=a),c.length>0&&(n.materials=c),l.length>0&&(n.textures=l),h.length>0&&(n.images=h),d.length>0&&(n.shapes=d),f.length>0&&(n.skeletons=f),u.length>0&&(n.animations=u),m.length>0&&(n.nodes=m)}return n.object=i,n;function o(a){const c=[];for(const l in a){const h=a[l];delete h.metadata,c.push(h)}return c}}clone(t){return new this.constructor().copy(this,t)}copy(t,e=!0){if(this.name=t.name,this.up.copy(t.up),this.position.copy(t.position),this.rotation.order=t.rotation.order,this.quaternion.copy(t.quaternion),this.scale.copy(t.scale),this.matrix.copy(t.matrix),this.matrixWorld.copy(t.matrixWorld),this.matrixAutoUpdate=t.matrixAutoUpdate,this.matrixWorldAutoUpdate=t.matrixWorldAutoUpdate,this.matrixWorldNeedsUpdate=t.matrixWorldNeedsUpdate,this.layers.mask=t.layers.mask,this.visible=t.visible,this.castShadow=t.castShadow,this.receiveShadow=t.receiveShadow,this.frustumCulled=t.frustumCulled,this.renderOrder=t.renderOrder,this.animations=t.animations.slice(),this.userData=JSON.parse(JSON.stringify(t.userData)),e===!0)for(let n=0;n<t.children.length;n++){const i=t.children[n];this.add(i.clone())}return this}}_e.DEFAULT_UP=new A(0,1,0);_e.DEFAULT_MATRIX_AUTO_UPDATE=!0;_e.DEFAULT_MATRIX_WORLD_AUTO_UPDATE=!0;const Un=new A,ai=new A,Ta=new A,ci=new A,gs=new A,vs=new A,yh=new A,Ea=new A,Aa=new A,Ra=new A,Ca=new we,Pa=new we,La=new we;class Ln{constructor(t=new A,e=new A,n=new A){this.a=t,this.b=e,this.c=n}static getNormal(t,e,n,i){i.subVectors(n,e),Un.subVectors(t,e),i.cross(Un);const s=i.lengthSq();return s>0?i.multiplyScalar(1/Math.sqrt(s)):i.set(0,0,0)}static getBarycoord(t,e,n,i,s){Un.subVectors(i,e),ai.subVectors(n,e),Ta.subVectors(t,e);const o=Un.dot(Un),a=Un.dot(ai),c=Un.dot(Ta),l=ai.dot(ai),h=ai.dot(Ta),d=o*l-a*a;if(d===0)return s.set(0,0,0),null;const f=1/d,u=(l*c-a*h)*f,m=(o*h-a*c)*f;return s.set(1-u-m,m,u)}static containsPoint(t,e,n,i){return this.getBarycoord(t,e,n,i,ci)===null?!1:ci.x>=0&&ci.y>=0&&ci.x+ci.y<=1}static getInterpolation(t,e,n,i,s,o,a,c){return this.getBarycoord(t,e,n,i,ci)===null?(c.x=0,c.y=0,"z"in c&&(c.z=0),"w"in c&&(c.w=0),null):(c.setScalar(0),c.addScaledVector(s,ci.x),c.addScaledVector(o,ci.y),c.addScaledVector(a,ci.z),c)}static getInterpolatedAttribute(t,e,n,i,s,o){return Ca.setScalar(0),Pa.setScalar(0),La.setScalar(0),Ca.fromBufferAttribute(t,e),Pa.fromBufferAttribute(t,n),La.fromBufferAttribute(t,i),o.setScalar(0),o.addScaledVector(Ca,s.x),o.addScaledVector(Pa,s.y),o.addScaledVector(La,s.z),o}static isFrontFacing(t,e,n,i){return Un.subVectors(n,e),ai.subVectors(t,e),Un.cross(ai).dot(i)<0}set(t,e,n){return this.a.copy(t),this.b.copy(e),this.c.copy(n),this}setFromPointsAndIndices(t,e,n,i){return this.a.copy(t[e]),this.b.copy(t[n]),this.c.copy(t[i]),this}setFromAttributeAndIndices(t,e,n,i){return this.a.fromBufferAttribute(t,e),this.b.fromBufferAttribute(t,n),this.c.fromBufferAttribute(t,i),this}clone(){return new this.constructor().copy(this)}copy(t){return this.a.copy(t.a),this.b.copy(t.b),this.c.copy(t.c),this}getArea(){return Un.subVectors(this.c,this.b),ai.subVectors(this.a,this.b),Un.cross(ai).length()*.5}getMidpoint(t){return t.addVectors(this.a,this.b).add(this.c).multiplyScalar(1/3)}getNormal(t){return Ln.getNormal(this.a,this.b,this.c,t)}getPlane(t){return t.setFromCoplanarPoints(this.a,this.b,this.c)}getBarycoord(t,e){return Ln.getBarycoord(t,this.a,this.b,this.c,e)}getInterpolation(t,e,n,i,s){return Ln.getInterpolation(t,this.a,this.b,this.c,e,n,i,s)}containsPoint(t){return Ln.containsPoint(t,this.a,this.b,this.c)}isFrontFacing(t){return Ln.isFrontFacing(this.a,this.b,this.c,t)}intersectsBox(t){return t.intersectsTriangle(this)}closestPointToPoint(t,e){const n=this.a,i=this.b,s=this.c;let o,a;gs.subVectors(i,n),vs.subVectors(s,n),Ea.subVectors(t,n);const c=gs.dot(Ea),l=vs.dot(Ea);if(c<=0&&l<=0)return e.copy(n);Aa.subVectors(t,i);const h=gs.dot(Aa),d=vs.dot(Aa);if(h>=0&&d<=h)return e.copy(i);const f=c*d-h*l;if(f<=0&&c>=0&&h<=0)return o=c/(c-h),e.copy(n).addScaledVector(gs,o);Ra.subVectors(t,s);const u=gs.dot(Ra),m=vs.dot(Ra);if(m>=0&&u<=m)return e.copy(s);const v=u*l-c*m;if(v<=0&&l>=0&&m<=0)return a=l/(l-m),e.copy(n).addScaledVector(vs,a);const p=h*m-u*d;if(p<=0&&d-h>=0&&u-m>=0)return yh.subVectors(s,i),a=(d-h)/(d-h+(u-m)),e.copy(i).addScaledVector(yh,a);const g=1/(p+v+f);return o=v*g,a=f*g,e.copy(n).addScaledVector(gs,o).addScaledVector(vs,a)}equals(t){return t.a.equals(this.a)&&t.b.equals(this.b)&&t.c.equals(this.c)}}const d0={aliceblue:15792383,antiquewhite:16444375,aqua:65535,aquamarine:8388564,azure:15794175,beige:16119260,bisque:16770244,black:0,blanchedalmond:16772045,blue:255,blueviolet:9055202,brown:10824234,burlywood:14596231,cadetblue:6266528,chartreuse:8388352,chocolate:13789470,coral:16744272,cornflowerblue:6591981,cornsilk:16775388,crimson:14423100,cyan:65535,darkblue:139,darkcyan:35723,darkgoldenrod:12092939,darkgray:11119017,darkgreen:25600,darkgrey:11119017,darkkhaki:12433259,darkmagenta:9109643,darkolivegreen:5597999,darkorange:16747520,darkorchid:10040012,darkred:9109504,darksalmon:15308410,darkseagreen:9419919,darkslateblue:4734347,darkslategray:3100495,darkslategrey:3100495,darkturquoise:52945,darkviolet:9699539,deeppink:16716947,deepskyblue:49151,dimgray:6908265,dimgrey:6908265,dodgerblue:2003199,firebrick:11674146,floralwhite:16775920,forestgreen:2263842,fuchsia:16711935,gainsboro:14474460,ghostwhite:16316671,gold:16766720,goldenrod:14329120,gray:8421504,green:32768,greenyellow:11403055,grey:8421504,honeydew:15794160,hotpink:16738740,indianred:13458524,indigo:4915330,ivory:16777200,khaki:15787660,lavender:15132410,lavenderblush:16773365,lawngreen:8190976,lemonchiffon:16775885,lightblue:11393254,lightcoral:15761536,lightcyan:14745599,lightgoldenrodyellow:16448210,lightgray:13882323,lightgreen:9498256,lightgrey:13882323,lightpink:16758465,lightsalmon:16752762,lightseagreen:2142890,lightskyblue:8900346,lightslategray:7833753,lightslategrey:7833753,lightsteelblue:11584734,lightyellow:16777184,lime:65280,limegreen:3329330,linen:16445670,magenta:16711935,maroon:8388608,mediumaquamarine:6737322,mediumblue:205,mediumorchid:12211667,mediumpurple:9662683,mediumseagreen:3978097,mediumslateblue:8087790,mediumspringgreen:64154,mediumturquoise:4772300,mediumvioletred:13047173,midnightblue:1644912,mintcream:16121850,mistyrose:16770273,moccasin:16770229,navajowhite:16768685,navy:128,oldlace:16643558,olive:8421376,olivedrab:7048739,orange:16753920,orangered:16729344,orchid:14315734,palegoldenrod:15657130,palegreen:10025880,paleturquoise:11529966,palevioletred:14381203,papayawhip:16773077,peachpuff:16767673,peru:13468991,pink:16761035,plum:14524637,powderblue:11591910,purple:8388736,rebeccapurple:6697881,red:16711680,rosybrown:12357519,royalblue:4286945,saddlebrown:9127187,salmon:16416882,sandybrown:16032864,seagreen:3050327,seashell:16774638,sienna:10506797,silver:12632256,skyblue:8900331,slateblue:6970061,slategray:7372944,slategrey:7372944,snow:16775930,springgreen:65407,steelblue:4620980,tan:13808780,teal:32896,thistle:14204888,tomato:16737095,turquoise:4251856,violet:15631086,wheat:16113331,white:16777215,whitesmoke:16119285,yellow:16776960,yellowgreen:10145074},Ti={h:0,s:0,l:0},Xr={h:0,s:0,l:0};function ka(r,t,e){return e<0&&(e+=1),e>1&&(e-=1),e<1/6?r+(t-r)*6*e:e<1/2?t:e<2/3?r+(t-r)*6*(2/3-e):r}class dt{constructor(t,e,n){return this.isColor=!0,this.r=1,this.g=1,this.b=1,this.set(t,e,n)}set(t,e,n){if(e===void 0&&n===void 0){const i=t;i&&i.isColor?this.copy(i):typeof i=="number"?this.setHex(i):typeof i=="string"&&this.setStyle(i)}else this.setRGB(t,e,n);return this}setScalar(t){return this.r=t,this.g=t,this.b=t,this}setHex(t,e=Mn){return t=Math.floor(t),this.r=(t>>16&255)/255,this.g=(t>>8&255)/255,this.b=(t&255)/255,me.toWorkingColorSpace(this,e),this}setRGB(t,e,n,i=me.workingColorSpace){return this.r=t,this.g=e,this.b=n,me.toWorkingColorSpace(this,i),this}setHSL(t,e,n,i=me.workingColorSpace){if(t=Ml(t,1),e=He(e,0,1),n=He(n,0,1),e===0)this.r=this.g=this.b=n;else{const s=n<=.5?n*(1+e):n+e-n*e,o=2*n-s;this.r=ka(o,s,t+1/3),this.g=ka(o,s,t),this.b=ka(o,s,t-1/3)}return me.toWorkingColorSpace(this,i),this}setStyle(t,e=Mn){function n(s){s!==void 0&&parseFloat(s)<1&&console.warn("THREE.Color: Alpha component of "+t+" will be ignored.")}let i;if(i=/^(\w+)\(([^\)]*)\)/.exec(t)){let s;const o=i[1],a=i[2];switch(o){case"rgb":case"rgba":if(s=/^\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(a))return n(s[4]),this.setRGB(Math.min(255,parseInt(s[1],10))/255,Math.min(255,parseInt(s[2],10))/255,Math.min(255,parseInt(s[3],10))/255,e);if(s=/^\s*(\d+)\%\s*,\s*(\d+)\%\s*,\s*(\d+)\%\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(a))return n(s[4]),this.setRGB(Math.min(100,parseInt(s[1],10))/100,Math.min(100,parseInt(s[2],10))/100,Math.min(100,parseInt(s[3],10))/100,e);break;case"hsl":case"hsla":if(s=/^\s*(\d*\.?\d+)\s*,\s*(\d*\.?\d+)\%\s*,\s*(\d*\.?\d+)\%\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(a))return n(s[4]),this.setHSL(parseFloat(s[1])/360,parseFloat(s[2])/100,parseFloat(s[3])/100,e);break;default:console.warn("THREE.Color: Unknown color model "+t)}}else if(i=/^\#([A-Fa-f\d]+)$/.exec(t)){const s=i[1],o=s.length;if(o===3)return this.setRGB(parseInt(s.charAt(0),16)/15,parseInt(s.charAt(1),16)/15,parseInt(s.charAt(2),16)/15,e);if(o===6)return this.setHex(parseInt(s,16),e);console.warn("THREE.Color: Invalid hex color "+t)}else if(t&&t.length>0)return this.setColorName(t,e);return this}setColorName(t,e=Mn){const n=d0[t.toLowerCase()];return n!==void 0?this.setHex(n,e):console.warn("THREE.Color: Unknown color "+t),this}clone(){return new this.constructor(this.r,this.g,this.b)}copy(t){return this.r=t.r,this.g=t.g,this.b=t.b,this}copySRGBToLinear(t){return this.r=Ds(t.r),this.g=Ds(t.g),this.b=Ds(t.b),this}copyLinearToSRGB(t){return this.r=ga(t.r),this.g=ga(t.g),this.b=ga(t.b),this}convertSRGBToLinear(){return this.copySRGBToLinear(this),this}convertLinearToSRGB(){return this.copyLinearToSRGB(this),this}getHex(t=Mn){return me.fromWorkingColorSpace(Je.copy(this),t),Math.round(He(Je.r*255,0,255))*65536+Math.round(He(Je.g*255,0,255))*256+Math.round(He(Je.b*255,0,255))}getHexString(t=Mn){return("000000"+this.getHex(t).toString(16)).slice(-6)}getHSL(t,e=me.workingColorSpace){me.fromWorkingColorSpace(Je.copy(this),e);const n=Je.r,i=Je.g,s=Je.b,o=Math.max(n,i,s),a=Math.min(n,i,s);let c,l;const h=(a+o)/2;if(a===o)c=0,l=0;else{const d=o-a;switch(l=h<=.5?d/(o+a):d/(2-o-a),o){case n:c=(i-s)/d+(i<s?6:0);break;case i:c=(s-n)/d+2;break;case s:c=(n-i)/d+4;break}c/=6}return t.h=c,t.s=l,t.l=h,t}getRGB(t,e=me.workingColorSpace){return me.fromWorkingColorSpace(Je.copy(this),e),t.r=Je.r,t.g=Je.g,t.b=Je.b,t}getStyle(t=Mn){me.fromWorkingColorSpace(Je.copy(this),t);const e=Je.r,n=Je.g,i=Je.b;return t!==Mn?`color(${t} ${e.toFixed(3)} ${n.toFixed(3)} ${i.toFixed(3)})`:`rgb(${Math.round(e*255)},${Math.round(n*255)},${Math.round(i*255)})`}offsetHSL(t,e,n){return this.getHSL(Ti),this.setHSL(Ti.h+t,Ti.s+e,Ti.l+n)}add(t){return this.r+=t.r,this.g+=t.g,this.b+=t.b,this}addColors(t,e){return this.r=t.r+e.r,this.g=t.g+e.g,this.b=t.b+e.b,this}addScalar(t){return this.r+=t,this.g+=t,this.b+=t,this}sub(t){return this.r=Math.max(0,this.r-t.r),this.g=Math.max(0,this.g-t.g),this.b=Math.max(0,this.b-t.b),this}multiply(t){return this.r*=t.r,this.g*=t.g,this.b*=t.b,this}multiplyScalar(t){return this.r*=t,this.g*=t,this.b*=t,this}lerp(t,e){return this.r+=(t.r-this.r)*e,this.g+=(t.g-this.g)*e,this.b+=(t.b-this.b)*e,this}lerpColors(t,e,n){return this.r=t.r+(e.r-t.r)*n,this.g=t.g+(e.g-t.g)*n,this.b=t.b+(e.b-t.b)*n,this}lerpHSL(t,e){this.getHSL(Ti),t.getHSL(Xr);const n=Tr(Ti.h,Xr.h,e),i=Tr(Ti.s,Xr.s,e),s=Tr(Ti.l,Xr.l,e);return this.setHSL(n,i,s),this}setFromVector3(t){return this.r=t.x,this.g=t.y,this.b=t.z,this}applyMatrix3(t){const e=this.r,n=this.g,i=this.b,s=t.elements;return this.r=s[0]*e+s[3]*n+s[6]*i,this.g=s[1]*e+s[4]*n+s[7]*i,this.b=s[2]*e+s[5]*n+s[8]*i,this}equals(t){return t.r===this.r&&t.g===this.g&&t.b===this.b}fromArray(t,e=0){return this.r=t[e],this.g=t[e+1],this.b=t[e+2],this}toArray(t=[],e=0){return t[e]=this.r,t[e+1]=this.g,t[e+2]=this.b,t}fromBufferAttribute(t,e){return this.r=t.getX(e),this.g=t.getY(e),this.b=t.getZ(e),this}toJSON(){return this.getHex()}*[Symbol.iterator](){yield this.r,yield this.g,yield this.b}}const Je=new dt;dt.NAMES=d0;let df=0;class Gi extends Zs{constructor(){super(),this.isMaterial=!0,Object.defineProperty(this,"id",{value:df++}),this.uuid=$n(),this.name="",this.type="Material",this.blending=ss,this.side=Bi,this.vertexColors=!1,this.opacity=1,this.transparent=!1,this.alphaHash=!1,this.blendSrc=mc,this.blendDst=gc,this.blendEquation=Li,this.blendSrcAlpha=null,this.blendDstAlpha=null,this.blendEquationAlpha=null,this.blendColor=new dt(0,0,0),this.blendAlpha=0,this.depthFunc=Bs,this.depthTest=!0,this.depthWrite=!0,this.stencilWriteMask=255,this.stencilFunc=oh,this.stencilRef=0,this.stencilFuncMask=255,this.stencilFail=cs,this.stencilZFail=cs,this.stencilZPass=cs,this.stencilWrite=!1,this.clippingPlanes=null,this.clipIntersection=!1,this.clipShadows=!1,this.shadowSide=null,this.colorWrite=!0,this.precision=null,this.polygonOffset=!1,this.polygonOffsetFactor=0,this.polygonOffsetUnits=0,this.dithering=!1,this.alphaToCoverage=!1,this.premultipliedAlpha=!1,this.forceSinglePass=!1,this.visible=!0,this.toneMapped=!0,this.userData={},this.version=0,this._alphaTest=0}get alphaTest(){return this._alphaTest}set alphaTest(t){this._alphaTest>0!=t>0&&this.version++,this._alphaTest=t}onBeforeRender(){}onBeforeCompile(){}customProgramCacheKey(){return this.onBeforeCompile.toString()}setValues(t){if(t!==void 0)for(const e in t){const n=t[e];if(n===void 0){console.warn(`THREE.Material: parameter '${e}' has value of undefined.`);continue}const i=this[e];if(i===void 0){console.warn(`THREE.Material: '${e}' is not a property of THREE.${this.type}.`);continue}i&&i.isColor?i.set(n):i&&i.isVector3&&n&&n.isVector3?i.copy(n):this[e]=n}}toJSON(t){const e=t===void 0||typeof t=="string";e&&(t={textures:{},images:{}});const n={metadata:{version:4.6,type:"Material",generator:"Material.toJSON"}};n.uuid=this.uuid,n.type=this.type,this.name!==""&&(n.name=this.name),this.color&&this.color.isColor&&(n.color=this.color.getHex()),this.roughness!==void 0&&(n.roughness=this.roughness),this.metalness!==void 0&&(n.metalness=this.metalness),this.sheen!==void 0&&(n.sheen=this.sheen),this.sheenColor&&this.sheenColor.isColor&&(n.sheenColor=this.sheenColor.getHex()),this.sheenRoughness!==void 0&&(n.sheenRoughness=this.sheenRoughness),this.emissive&&this.emissive.isColor&&(n.emissive=this.emissive.getHex()),this.emissiveIntensity!==void 0&&this.emissiveIntensity!==1&&(n.emissiveIntensity=this.emissiveIntensity),this.specular&&this.specular.isColor&&(n.specular=this.specular.getHex()),this.specularIntensity!==void 0&&(n.specularIntensity=this.specularIntensity),this.specularColor&&this.specularColor.isColor&&(n.specularColor=this.specularColor.getHex()),this.shininess!==void 0&&(n.shininess=this.shininess),this.clearcoat!==void 0&&(n.clearcoat=this.clearcoat),this.clearcoatRoughness!==void 0&&(n.clearcoatRoughness=this.clearcoatRoughness),this.clearcoatMap&&this.clearcoatMap.isTexture&&(n.clearcoatMap=this.clearcoatMap.toJSON(t).uuid),this.clearcoatRoughnessMap&&this.clearcoatRoughnessMap.isTexture&&(n.clearcoatRoughnessMap=this.clearcoatRoughnessMap.toJSON(t).uuid),this.clearcoatNormalMap&&this.clearcoatNormalMap.isTexture&&(n.clearcoatNormalMap=this.clearcoatNormalMap.toJSON(t).uuid,n.clearcoatNormalScale=this.clearcoatNormalScale.toArray()),this.dispersion!==void 0&&(n.dispersion=this.dispersion),this.iridescence!==void 0&&(n.iridescence=this.iridescence),this.iridescenceIOR!==void 0&&(n.iridescenceIOR=this.iridescenceIOR),this.iridescenceThicknessRange!==void 0&&(n.iridescenceThicknessRange=this.iridescenceThicknessRange),this.iridescenceMap&&this.iridescenceMap.isTexture&&(n.iridescenceMap=this.iridescenceMap.toJSON(t).uuid),this.iridescenceThicknessMap&&this.iridescenceThicknessMap.isTexture&&(n.iridescenceThicknessMap=this.iridescenceThicknessMap.toJSON(t).uuid),this.anisotropy!==void 0&&(n.anisotropy=this.anisotropy),this.anisotropyRotation!==void 0&&(n.anisotropyRotation=this.anisotropyRotation),this.anisotropyMap&&this.anisotropyMap.isTexture&&(n.anisotropyMap=this.anisotropyMap.toJSON(t).uuid),this.map&&this.map.isTexture&&(n.map=this.map.toJSON(t).uuid),this.matcap&&this.matcap.isTexture&&(n.matcap=this.matcap.toJSON(t).uuid),this.alphaMap&&this.alphaMap.isTexture&&(n.alphaMap=this.alphaMap.toJSON(t).uuid),this.lightMap&&this.lightMap.isTexture&&(n.lightMap=this.lightMap.toJSON(t).uuid,n.lightMapIntensity=this.lightMapIntensity),this.aoMap&&this.aoMap.isTexture&&(n.aoMap=this.aoMap.toJSON(t).uuid,n.aoMapIntensity=this.aoMapIntensity),this.bumpMap&&this.bumpMap.isTexture&&(n.bumpMap=this.bumpMap.toJSON(t).uuid,n.bumpScale=this.bumpScale),this.normalMap&&this.normalMap.isTexture&&(n.normalMap=this.normalMap.toJSON(t).uuid,n.normalMapType=this.normalMapType,n.normalScale=this.normalScale.toArray()),this.displacementMap&&this.displacementMap.isTexture&&(n.displacementMap=this.displacementMap.toJSON(t).uuid,n.displacementScale=this.displacementScale,n.displacementBias=this.displacementBias),this.roughnessMap&&this.roughnessMap.isTexture&&(n.roughnessMap=this.roughnessMap.toJSON(t).uuid),this.metalnessMap&&this.metalnessMap.isTexture&&(n.metalnessMap=this.metalnessMap.toJSON(t).uuid),this.emissiveMap&&this.emissiveMap.isTexture&&(n.emissiveMap=this.emissiveMap.toJSON(t).uuid),this.specularMap&&this.specularMap.isTexture&&(n.specularMap=this.specularMap.toJSON(t).uuid),this.specularIntensityMap&&this.specularIntensityMap.isTexture&&(n.specularIntensityMap=this.specularIntensityMap.toJSON(t).uuid),this.specularColorMap&&this.specularColorMap.isTexture&&(n.specularColorMap=this.specularColorMap.toJSON(t).uuid),this.envMap&&this.envMap.isTexture&&(n.envMap=this.envMap.toJSON(t).uuid,this.combine!==void 0&&(n.combine=this.combine)),this.envMapRotation!==void 0&&(n.envMapRotation=this.envMapRotation.toArray()),this.envMapIntensity!==void 0&&(n.envMapIntensity=this.envMapIntensity),this.reflectivity!==void 0&&(n.reflectivity=this.reflectivity),this.refractionRatio!==void 0&&(n.refractionRatio=this.refractionRatio),this.gradientMap&&this.gradientMap.isTexture&&(n.gradientMap=this.gradientMap.toJSON(t).uuid),this.transmission!==void 0&&(n.transmission=this.transmission),this.transmissionMap&&this.transmissionMap.isTexture&&(n.transmissionMap=this.transmissionMap.toJSON(t).uuid),this.thickness!==void 0&&(n.thickness=this.thickness),this.thicknessMap&&this.thicknessMap.isTexture&&(n.thicknessMap=this.thicknessMap.toJSON(t).uuid),this.attenuationDistance!==void 0&&this.attenuationDistance!==1/0&&(n.attenuationDistance=this.attenuationDistance),this.attenuationColor!==void 0&&(n.attenuationColor=this.attenuationColor.getHex()),this.size!==void 0&&(n.size=this.size),this.shadowSide!==null&&(n.shadowSide=this.shadowSide),this.sizeAttenuation!==void 0&&(n.sizeAttenuation=this.sizeAttenuation),this.blending!==ss&&(n.blending=this.blending),this.side!==Bi&&(n.side=this.side),this.vertexColors===!0&&(n.vertexColors=!0),this.opacity<1&&(n.opacity=this.opacity),this.transparent===!0&&(n.transparent=!0),this.blendSrc!==mc&&(n.blendSrc=this.blendSrc),this.blendDst!==gc&&(n.blendDst=this.blendDst),this.blendEquation!==Li&&(n.blendEquation=this.blendEquation),this.blendSrcAlpha!==null&&(n.blendSrcAlpha=this.blendSrcAlpha),this.blendDstAlpha!==null&&(n.blendDstAlpha=this.blendDstAlpha),this.blendEquationAlpha!==null&&(n.blendEquationAlpha=this.blendEquationAlpha),this.blendColor&&this.blendColor.isColor&&(n.blendColor=this.blendColor.getHex()),this.blendAlpha!==0&&(n.blendAlpha=this.blendAlpha),this.depthFunc!==Bs&&(n.depthFunc=this.depthFunc),this.depthTest===!1&&(n.depthTest=this.depthTest),this.depthWrite===!1&&(n.depthWrite=this.depthWrite),this.colorWrite===!1&&(n.colorWrite=this.colorWrite),this.stencilWriteMask!==255&&(n.stencilWriteMask=this.stencilWriteMask),this.stencilFunc!==oh&&(n.stencilFunc=this.stencilFunc),this.stencilRef!==0&&(n.stencilRef=this.stencilRef),this.stencilFuncMask!==255&&(n.stencilFuncMask=this.stencilFuncMask),this.stencilFail!==cs&&(n.stencilFail=this.stencilFail),this.stencilZFail!==cs&&(n.stencilZFail=this.stencilZFail),this.stencilZPass!==cs&&(n.stencilZPass=this.stencilZPass),this.stencilWrite===!0&&(n.stencilWrite=this.stencilWrite),this.rotation!==void 0&&this.rotation!==0&&(n.rotation=this.rotation),this.polygonOffset===!0&&(n.polygonOffset=!0),this.polygonOffsetFactor!==0&&(n.polygonOffsetFactor=this.polygonOffsetFactor),this.polygonOffsetUnits!==0&&(n.polygonOffsetUnits=this.polygonOffsetUnits),this.linewidth!==void 0&&this.linewidth!==1&&(n.linewidth=this.linewidth),this.dashSize!==void 0&&(n.dashSize=this.dashSize),this.gapSize!==void 0&&(n.gapSize=this.gapSize),this.scale!==void 0&&(n.scale=this.scale),this.dithering===!0&&(n.dithering=!0),this.alphaTest>0&&(n.alphaTest=this.alphaTest),this.alphaHash===!0&&(n.alphaHash=!0),this.alphaToCoverage===!0&&(n.alphaToCoverage=!0),this.premultipliedAlpha===!0&&(n.premultipliedAlpha=!0),this.forceSinglePass===!0&&(n.forceSinglePass=!0),this.wireframe===!0&&(n.wireframe=!0),this.wireframeLinewidth>1&&(n.wireframeLinewidth=this.wireframeLinewidth),this.wireframeLinecap!=="round"&&(n.wireframeLinecap=this.wireframeLinecap),this.wireframeLinejoin!=="round"&&(n.wireframeLinejoin=this.wireframeLinejoin),this.flatShading===!0&&(n.flatShading=!0),this.visible===!1&&(n.visible=!1),this.toneMapped===!1&&(n.toneMapped=!1),this.fog===!1&&(n.fog=!1),Object.keys(this.userData).length>0&&(n.userData=this.userData);function i(s){const o=[];for(const a in s){const c=s[a];delete c.metadata,o.push(c)}return o}if(e){const s=i(t.textures),o=i(t.images);s.length>0&&(n.textures=s),o.length>0&&(n.images=o)}return n}clone(){return new this.constructor().copy(this)}copy(t){this.name=t.name,this.blending=t.blending,this.side=t.side,this.vertexColors=t.vertexColors,this.opacity=t.opacity,this.transparent=t.transparent,this.blendSrc=t.blendSrc,this.blendDst=t.blendDst,this.blendEquation=t.blendEquation,this.blendSrcAlpha=t.blendSrcAlpha,this.blendDstAlpha=t.blendDstAlpha,this.blendEquationAlpha=t.blendEquationAlpha,this.blendColor.copy(t.blendColor),this.blendAlpha=t.blendAlpha,this.depthFunc=t.depthFunc,this.depthTest=t.depthTest,this.depthWrite=t.depthWrite,this.stencilWriteMask=t.stencilWriteMask,this.stencilFunc=t.stencilFunc,this.stencilRef=t.stencilRef,this.stencilFuncMask=t.stencilFuncMask,this.stencilFail=t.stencilFail,this.stencilZFail=t.stencilZFail,this.stencilZPass=t.stencilZPass,this.stencilWrite=t.stencilWrite;const e=t.clippingPlanes;let n=null;if(e!==null){const i=e.length;n=new Array(i);for(let s=0;s!==i;++s)n[s]=e[s].clone()}return this.clippingPlanes=n,this.clipIntersection=t.clipIntersection,this.clipShadows=t.clipShadows,this.shadowSide=t.shadowSide,this.colorWrite=t.colorWrite,this.precision=t.precision,this.polygonOffset=t.polygonOffset,this.polygonOffsetFactor=t.polygonOffsetFactor,this.polygonOffsetUnits=t.polygonOffsetUnits,this.dithering=t.dithering,this.alphaTest=t.alphaTest,this.alphaHash=t.alphaHash,this.alphaToCoverage=t.alphaToCoverage,this.premultipliedAlpha=t.premultipliedAlpha,this.forceSinglePass=t.forceSinglePass,this.visible=t.visible,this.toneMapped=t.toneMapped,this.userData=JSON.parse(JSON.stringify(t.userData)),this}dispose(){this.dispatchEvent({type:"dispose"})}set needsUpdate(t){t===!0&&this.version++}onBuild(){console.warn("Material: onBuild() has been removed.")}}class ea extends Gi{constructor(t){super(),this.isMeshBasicMaterial=!0,this.type="MeshBasicMaterial",this.color=new dt(16777215),this.map=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.specularMap=null,this.alphaMap=null,this.envMap=null,this.envMapRotation=new Ve,this.combine=qu,this.reflectivity=1,this.refractionRatio=.98,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap="round",this.wireframeLinejoin="round",this.fog=!0,this.setValues(t)}copy(t){return super.copy(t),this.color.copy(t.color),this.map=t.map,this.lightMap=t.lightMap,this.lightMapIntensity=t.lightMapIntensity,this.aoMap=t.aoMap,this.aoMapIntensity=t.aoMapIntensity,this.specularMap=t.specularMap,this.alphaMap=t.alphaMap,this.envMap=t.envMap,this.envMapRotation.copy(t.envMapRotation),this.combine=t.combine,this.reflectivity=t.reflectivity,this.refractionRatio=t.refractionRatio,this.wireframe=t.wireframe,this.wireframeLinewidth=t.wireframeLinewidth,this.wireframeLinecap=t.wireframeLinecap,this.wireframeLinejoin=t.wireframeLinejoin,this.fog=t.fog,this}}const Ue=new A,jr=new ct;class te{constructor(t,e,n=!1){if(Array.isArray(t))throw new TypeError("THREE.BufferAttribute: array should be a Typed Array.");this.isBufferAttribute=!0,this.name="",this.array=t,this.itemSize=e,this.count=t!==void 0?t.length/e:0,this.normalized=n,this.usage=Qc,this.updateRanges=[],this.gpuType=fn,this.version=0}onUploadCallback(){}set needsUpdate(t){t===!0&&this.version++}setUsage(t){return this.usage=t,this}addUpdateRange(t,e){this.updateRanges.push({start:t,count:e})}clearUpdateRanges(){this.updateRanges.length=0}copy(t){return this.name=t.name,this.array=new t.array.constructor(t.array),this.itemSize=t.itemSize,this.count=t.count,this.normalized=t.normalized,this.usage=t.usage,this.gpuType=t.gpuType,this}copyAt(t,e,n){t*=this.itemSize,n*=e.itemSize;for(let i=0,s=this.itemSize;i<s;i++)this.array[t+i]=e.array[n+i];return this}copyArray(t){return this.array.set(t),this}applyMatrix3(t){if(this.itemSize===2)for(let e=0,n=this.count;e<n;e++)jr.fromBufferAttribute(this,e),jr.applyMatrix3(t),this.setXY(e,jr.x,jr.y);else if(this.itemSize===3)for(let e=0,n=this.count;e<n;e++)Ue.fromBufferAttribute(this,e),Ue.applyMatrix3(t),this.setXYZ(e,Ue.x,Ue.y,Ue.z);return this}applyMatrix4(t){for(let e=0,n=this.count;e<n;e++)Ue.fromBufferAttribute(this,e),Ue.applyMatrix4(t),this.setXYZ(e,Ue.x,Ue.y,Ue.z);return this}applyNormalMatrix(t){for(let e=0,n=this.count;e<n;e++)Ue.fromBufferAttribute(this,e),Ue.applyNormalMatrix(t),this.setXYZ(e,Ue.x,Ue.y,Ue.z);return this}transformDirection(t){for(let e=0,n=this.count;e<n;e++)Ue.fromBufferAttribute(this,e),Ue.transformDirection(t),this.setXYZ(e,Ue.x,Ue.y,Ue.z);return this}set(t,e=0){return this.array.set(t,e),this}getComponent(t,e){let n=this.array[t*this.itemSize+e];return this.normalized&&(n=On(n,this.array)),n}setComponent(t,e,n){return this.normalized&&(n=xe(n,this.array)),this.array[t*this.itemSize+e]=n,this}getX(t){let e=this.array[t*this.itemSize];return this.normalized&&(e=On(e,this.array)),e}setX(t,e){return this.normalized&&(e=xe(e,this.array)),this.array[t*this.itemSize]=e,this}getY(t){let e=this.array[t*this.itemSize+1];return this.normalized&&(e=On(e,this.array)),e}setY(t,e){return this.normalized&&(e=xe(e,this.array)),this.array[t*this.itemSize+1]=e,this}getZ(t){let e=this.array[t*this.itemSize+2];return this.normalized&&(e=On(e,this.array)),e}setZ(t,e){return this.normalized&&(e=xe(e,this.array)),this.array[t*this.itemSize+2]=e,this}getW(t){let e=this.array[t*this.itemSize+3];return this.normalized&&(e=On(e,this.array)),e}setW(t,e){return this.normalized&&(e=xe(e,this.array)),this.array[t*this.itemSize+3]=e,this}setXY(t,e,n){return t*=this.itemSize,this.normalized&&(e=xe(e,this.array),n=xe(n,this.array)),this.array[t+0]=e,this.array[t+1]=n,this}setXYZ(t,e,n,i){return t*=this.itemSize,this.normalized&&(e=xe(e,this.array),n=xe(n,this.array),i=xe(i,this.array)),this.array[t+0]=e,this.array[t+1]=n,this.array[t+2]=i,this}setXYZW(t,e,n,i,s){return t*=this.itemSize,this.normalized&&(e=xe(e,this.array),n=xe(n,this.array),i=xe(i,this.array),s=xe(s,this.array)),this.array[t+0]=e,this.array[t+1]=n,this.array[t+2]=i,this.array[t+3]=s,this}onUpload(t){return this.onUploadCallback=t,this}clone(){return new this.constructor(this.array,this.itemSize).copy(this)}toJSON(){const t={itemSize:this.itemSize,type:this.array.constructor.name,array:Array.from(this.array),normalized:this.normalized};return this.name!==""&&(t.name=this.name),this.usage!==Qc&&(t.usage=this.usage),t}}class bl extends te{constructor(t,e,n){super(new Uint16Array(t),e,n)}}class f0 extends te{constructor(t,e,n){super(new Uint32Array(t),e,n)}}class $t extends te{constructor(t,e,n){super(new Float32Array(t),e,n)}}let ff=0;const En=new Dt,Da=new _e,xs=new A,xn=new Vi,sr=new Vi,qe=new A;class ge extends Zs{constructor(){super(),this.isBufferGeometry=!0,Object.defineProperty(this,"id",{value:ff++}),this.uuid=$n(),this.name="",this.type="BufferGeometry",this.index=null,this.attributes={},this.morphAttributes={},this.morphTargetsRelative=!1,this.groups=[],this.boundingBox=null,this.boundingSphere=null,this.drawRange={start:0,count:1/0},this.userData={}}getIndex(){return this.index}setIndex(t){return Array.isArray(t)?this.index=new(c0(t)?f0:bl)(t,1):this.index=t,this}getAttribute(t){return this.attributes[t]}setAttribute(t,e){return this.attributes[t]=e,this}deleteAttribute(t){return delete this.attributes[t],this}hasAttribute(t){return this.attributes[t]!==void 0}addGroup(t,e,n=0){this.groups.push({start:t,count:e,materialIndex:n})}clearGroups(){this.groups=[]}setDrawRange(t,e){this.drawRange.start=t,this.drawRange.count=e}applyMatrix4(t){const e=this.attributes.position;e!==void 0&&(e.applyMatrix4(t),e.needsUpdate=!0);const n=this.attributes.normal;if(n!==void 0){const s=new Qt().getNormalMatrix(t);n.applyNormalMatrix(s),n.needsUpdate=!0}const i=this.attributes.tangent;return i!==void 0&&(i.transformDirection(t),i.needsUpdate=!0),this.boundingBox!==null&&this.computeBoundingBox(),this.boundingSphere!==null&&this.computeBoundingSphere(),this}applyQuaternion(t){return En.makeRotationFromQuaternion(t),this.applyMatrix4(En),this}rotateX(t){return En.makeRotationX(t),this.applyMatrix4(En),this}rotateY(t){return En.makeRotationY(t),this.applyMatrix4(En),this}rotateZ(t){return En.makeRotationZ(t),this.applyMatrix4(En),this}translate(t,e,n){return En.makeTranslation(t,e,n),this.applyMatrix4(En),this}scale(t,e,n){return En.makeScale(t,e,n),this.applyMatrix4(En),this}lookAt(t){return Da.lookAt(t),Da.updateMatrix(),this.applyMatrix4(Da.matrix),this}center(){return this.computeBoundingBox(),this.boundingBox.getCenter(xs).negate(),this.translate(xs.x,xs.y,xs.z),this}setFromPoints(t){const e=[];for(let n=0,i=t.length;n<i;n++){const s=t[n];e.push(s.x,s.y,s.z||0)}return this.setAttribute("position",new $t(e,3)),this}computeBoundingBox(){this.boundingBox===null&&(this.boundingBox=new Vi);const t=this.attributes.position,e=this.morphAttributes.position;if(t&&t.isGLBufferAttribute){console.error("THREE.BufferGeometry.computeBoundingBox(): GLBufferAttribute requires a manual bounding box.",this),this.boundingBox.set(new A(-1/0,-1/0,-1/0),new A(1/0,1/0,1/0));return}if(t!==void 0){if(this.boundingBox.setFromBufferAttribute(t),e)for(let n=0,i=e.length;n<i;n++){const s=e[n];xn.setFromBufferAttribute(s),this.morphTargetsRelative?(qe.addVectors(this.boundingBox.min,xn.min),this.boundingBox.expandByPoint(qe),qe.addVectors(this.boundingBox.max,xn.max),this.boundingBox.expandByPoint(qe)):(this.boundingBox.expandByPoint(xn.min),this.boundingBox.expandByPoint(xn.max))}}else this.boundingBox.makeEmpty();(isNaN(this.boundingBox.min.x)||isNaN(this.boundingBox.min.y)||isNaN(this.boundingBox.min.z))&&console.error('THREE.BufferGeometry.computeBoundingBox(): Computed min/max have NaN values. The "position" attribute is likely to have NaN values.',this)}computeBoundingSphere(){this.boundingSphere===null&&(this.boundingSphere=new ni);const t=this.attributes.position,e=this.morphAttributes.position;if(t&&t.isGLBufferAttribute){console.error("THREE.BufferGeometry.computeBoundingSphere(): GLBufferAttribute requires a manual bounding sphere.",this),this.boundingSphere.set(new A,1/0);return}if(t){const n=this.boundingSphere.center;if(xn.setFromBufferAttribute(t),e)for(let s=0,o=e.length;s<o;s++){const a=e[s];sr.setFromBufferAttribute(a),this.morphTargetsRelative?(qe.addVectors(xn.min,sr.min),xn.expandByPoint(qe),qe.addVectors(xn.max,sr.max),xn.expandByPoint(qe)):(xn.expandByPoint(sr.min),xn.expandByPoint(sr.max))}xn.getCenter(n);let i=0;for(let s=0,o=t.count;s<o;s++)qe.fromBufferAttribute(t,s),i=Math.max(i,n.distanceToSquared(qe));if(e)for(let s=0,o=e.length;s<o;s++){const a=e[s],c=this.morphTargetsRelative;for(let l=0,h=a.count;l<h;l++)qe.fromBufferAttribute(a,l),c&&(xs.fromBufferAttribute(t,l),qe.add(xs)),i=Math.max(i,n.distanceToSquared(qe))}this.boundingSphere.radius=Math.sqrt(i),isNaN(this.boundingSphere.radius)&&console.error('THREE.BufferGeometry.computeBoundingSphere(): Computed radius is NaN. The "position" attribute is likely to have NaN values.',this)}}computeTangents(){const t=this.index,e=this.attributes;if(t===null||e.position===void 0||e.normal===void 0||e.uv===void 0){console.error("THREE.BufferGeometry: .computeTangents() failed. Missing required attributes (index, position, normal or uv)");return}const n=e.position,i=e.normal,s=e.uv;this.hasAttribute("tangent")===!1&&this.setAttribute("tangent",new te(new Float32Array(4*n.count),4));const o=this.getAttribute("tangent"),a=[],c=[];for(let E=0;E<n.count;E++)a[E]=new A,c[E]=new A;const l=new A,h=new A,d=new A,f=new ct,u=new ct,m=new ct,v=new A,p=new A;function g(E,D,M){l.fromBufferAttribute(n,E),h.fromBufferAttribute(n,D),d.fromBufferAttribute(n,M),f.fromBufferAttribute(s,E),u.fromBufferAttribute(s,D),m.fromBufferAttribute(s,M),h.sub(l),d.sub(l),u.sub(f),m.sub(f);const S=1/(u.x*m.y-m.x*u.y);isFinite(S)&&(v.copy(h).multiplyScalar(m.y).addScaledVector(d,-u.y).multiplyScalar(S),p.copy(d).multiplyScalar(u.x).addScaledVector(h,-m.x).multiplyScalar(S),a[E].add(v),a[D].add(v),a[M].add(v),c[E].add(p),c[D].add(p),c[M].add(p))}let x=this.groups;x.length===0&&(x=[{start:0,count:t.count}]);for(let E=0,D=x.length;E<D;++E){const M=x[E],S=M.start,k=M.count;for(let N=S,z=S+k;N<z;N+=3)g(t.getX(N+0),t.getX(N+1),t.getX(N+2))}const _=new A,y=new A,w=new A,T=new A;function R(E){w.fromBufferAttribute(i,E),T.copy(w);const D=a[E];_.copy(D),_.sub(w.multiplyScalar(w.dot(D))).normalize(),y.crossVectors(T,D);const S=y.dot(c[E])<0?-1:1;o.setXYZW(E,_.x,_.y,_.z,S)}for(let E=0,D=x.length;E<D;++E){const M=x[E],S=M.start,k=M.count;for(let N=S,z=S+k;N<z;N+=3)R(t.getX(N+0)),R(t.getX(N+1)),R(t.getX(N+2))}}computeVertexNormals(){const t=this.index,e=this.getAttribute("position");if(e!==void 0){let n=this.getAttribute("normal");if(n===void 0)n=new te(new Float32Array(e.count*3),3),this.setAttribute("normal",n);else for(let f=0,u=n.count;f<u;f++)n.setXYZ(f,0,0,0);const i=new A,s=new A,o=new A,a=new A,c=new A,l=new A,h=new A,d=new A;if(t)for(let f=0,u=t.count;f<u;f+=3){const m=t.getX(f+0),v=t.getX(f+1),p=t.getX(f+2);i.fromBufferAttribute(e,m),s.fromBufferAttribute(e,v),o.fromBufferAttribute(e,p),h.subVectors(o,s),d.subVectors(i,s),h.cross(d),a.fromBufferAttribute(n,m),c.fromBufferAttribute(n,v),l.fromBufferAttribute(n,p),a.add(h),c.add(h),l.add(h),n.setXYZ(m,a.x,a.y,a.z),n.setXYZ(v,c.x,c.y,c.z),n.setXYZ(p,l.x,l.y,l.z)}else for(let f=0,u=e.count;f<u;f+=3)i.fromBufferAttribute(e,f+0),s.fromBufferAttribute(e,f+1),o.fromBufferAttribute(e,f+2),h.subVectors(o,s),d.subVectors(i,s),h.cross(d),n.setXYZ(f+0,h.x,h.y,h.z),n.setXYZ(f+1,h.x,h.y,h.z),n.setXYZ(f+2,h.x,h.y,h.z);this.normalizeNormals(),n.needsUpdate=!0}}normalizeNormals(){const t=this.attributes.normal;for(let e=0,n=t.count;e<n;e++)qe.fromBufferAttribute(t,e),qe.normalize(),t.setXYZ(e,qe.x,qe.y,qe.z)}toNonIndexed(){function t(a,c){const l=a.array,h=a.itemSize,d=a.normalized,f=new l.constructor(c.length*h);let u=0,m=0;for(let v=0,p=c.length;v<p;v++){a.isInterleavedBufferAttribute?u=c[v]*a.data.stride+a.offset:u=c[v]*h;for(let g=0;g<h;g++)f[m++]=l[u++]}return new te(f,h,d)}if(this.index===null)return console.warn("THREE.BufferGeometry.toNonIndexed(): BufferGeometry is already non-indexed."),this;const e=new ge,n=this.index.array,i=this.attributes;for(const a in i){const c=i[a],l=t(c,n);e.setAttribute(a,l)}const s=this.morphAttributes;for(const a in s){const c=[],l=s[a];for(let h=0,d=l.length;h<d;h++){const f=l[h],u=t(f,n);c.push(u)}e.morphAttributes[a]=c}e.morphTargetsRelative=this.morphTargetsRelative;const o=this.groups;for(let a=0,c=o.length;a<c;a++){const l=o[a];e.addGroup(l.start,l.count,l.materialIndex)}return e}toJSON(){const t={metadata:{version:4.6,type:"BufferGeometry",generator:"BufferGeometry.toJSON"}};if(t.uuid=this.uuid,t.type=this.type,this.name!==""&&(t.name=this.name),Object.keys(this.userData).length>0&&(t.userData=this.userData),this.parameters!==void 0){const c=this.parameters;for(const l in c)c[l]!==void 0&&(t[l]=c[l]);return t}t.data={attributes:{}};const e=this.index;e!==null&&(t.data.index={type:e.array.constructor.name,array:Array.prototype.slice.call(e.array)});const n=this.attributes;for(const c in n){const l=n[c];t.data.attributes[c]=l.toJSON(t.data)}const i={};let s=!1;for(const c in this.morphAttributes){const l=this.morphAttributes[c],h=[];for(let d=0,f=l.length;d<f;d++){const u=l[d];h.push(u.toJSON(t.data))}h.length>0&&(i[c]=h,s=!0)}s&&(t.data.morphAttributes=i,t.data.morphTargetsRelative=this.morphTargetsRelative);const o=this.groups;o.length>0&&(t.data.groups=JSON.parse(JSON.stringify(o)));const a=this.boundingSphere;return a!==null&&(t.data.boundingSphere={center:a.center.toArray(),radius:a.radius}),t}clone(){return new this.constructor().copy(this)}copy(t){this.index=null,this.attributes={},this.morphAttributes={},this.groups=[],this.boundingBox=null,this.boundingSphere=null;const e={};this.name=t.name;const n=t.index;n!==null&&this.setIndex(n.clone(e));const i=t.attributes;for(const l in i){const h=i[l];this.setAttribute(l,h.clone(e))}const s=t.morphAttributes;for(const l in s){const h=[],d=s[l];for(let f=0,u=d.length;f<u;f++)h.push(d[f].clone(e));this.morphAttributes[l]=h}this.morphTargetsRelative=t.morphTargetsRelative;const o=t.groups;for(let l=0,h=o.length;l<h;l++){const d=o[l];this.addGroup(d.start,d.count,d.materialIndex)}const a=t.boundingBox;a!==null&&(this.boundingBox=a.clone());const c=t.boundingSphere;return c!==null&&(this.boundingSphere=c.clone()),this.drawRange.start=t.drawRange.start,this.drawRange.count=t.drawRange.count,this.userData=t.userData,this}dispose(){this.dispatchEvent({type:"dispose"})}}const Mh=new Dt,Yi=new ta,Yr=new ni,bh=new A,$r=new A,Kr=new A,Zr=new A,Ia=new A,Jr=new A,Sh=new A,Qr=new A;class Ht extends _e{constructor(t=new ge,e=new ea){super(),this.isMesh=!0,this.type="Mesh",this.geometry=t,this.material=e,this.updateMorphTargets()}copy(t,e){return super.copy(t,e),t.morphTargetInfluences!==void 0&&(this.morphTargetInfluences=t.morphTargetInfluences.slice()),t.morphTargetDictionary!==void 0&&(this.morphTargetDictionary=Object.assign({},t.morphTargetDictionary)),this.material=Array.isArray(t.material)?t.material.slice():t.material,this.geometry=t.geometry,this}updateMorphTargets(){const e=this.geometry.morphAttributes,n=Object.keys(e);if(n.length>0){const i=e[n[0]];if(i!==void 0){this.morphTargetInfluences=[],this.morphTargetDictionary={};for(let s=0,o=i.length;s<o;s++){const a=i[s].name||String(s);this.morphTargetInfluences.push(0),this.morphTargetDictionary[a]=s}}}}getVertexPosition(t,e){const n=this.geometry,i=n.attributes.position,s=n.morphAttributes.position,o=n.morphTargetsRelative;e.fromBufferAttribute(i,t);const a=this.morphTargetInfluences;if(s&&a){Jr.set(0,0,0);for(let c=0,l=s.length;c<l;c++){const h=a[c],d=s[c];h!==0&&(Ia.fromBufferAttribute(d,t),o?Jr.addScaledVector(Ia,h):Jr.addScaledVector(Ia.sub(e),h))}e.add(Jr)}return e}raycast(t,e){const n=this.geometry,i=this.material,s=this.matrixWorld;i!==void 0&&(n.boundingSphere===null&&n.computeBoundingSphere(),Yr.copy(n.boundingSphere),Yr.applyMatrix4(s),Yi.copy(t.ray).recast(t.near),!(Yr.containsPoint(Yi.origin)===!1&&(Yi.intersectSphere(Yr,bh)===null||Yi.origin.distanceToSquared(bh)>(t.far-t.near)**2))&&(Mh.copy(s).invert(),Yi.copy(t.ray).applyMatrix4(Mh),!(n.boundingBox!==null&&Yi.intersectsBox(n.boundingBox)===!1)&&this._computeIntersections(t,e,Yi)))}_computeIntersections(t,e,n){let i;const s=this.geometry,o=this.material,a=s.index,c=s.attributes.position,l=s.attributes.uv,h=s.attributes.uv1,d=s.attributes.normal,f=s.groups,u=s.drawRange;if(a!==null)if(Array.isArray(o))for(let m=0,v=f.length;m<v;m++){const p=f[m],g=o[p.materialIndex],x=Math.max(p.start,u.start),_=Math.min(a.count,Math.min(p.start+p.count,u.start+u.count));for(let y=x,w=_;y<w;y+=3){const T=a.getX(y),R=a.getX(y+1),E=a.getX(y+2);i=to(this,g,t,n,l,h,d,T,R,E),i&&(i.faceIndex=Math.floor(y/3),i.face.materialIndex=p.materialIndex,e.push(i))}}else{const m=Math.max(0,u.start),v=Math.min(a.count,u.start+u.count);for(let p=m,g=v;p<g;p+=3){const x=a.getX(p),_=a.getX(p+1),y=a.getX(p+2);i=to(this,o,t,n,l,h,d,x,_,y),i&&(i.faceIndex=Math.floor(p/3),e.push(i))}}else if(c!==void 0)if(Array.isArray(o))for(let m=0,v=f.length;m<v;m++){const p=f[m],g=o[p.materialIndex],x=Math.max(p.start,u.start),_=Math.min(c.count,Math.min(p.start+p.count,u.start+u.count));for(let y=x,w=_;y<w;y+=3){const T=y,R=y+1,E=y+2;i=to(this,g,t,n,l,h,d,T,R,E),i&&(i.faceIndex=Math.floor(y/3),i.face.materialIndex=p.materialIndex,e.push(i))}}else{const m=Math.max(0,u.start),v=Math.min(c.count,u.start+u.count);for(let p=m,g=v;p<g;p+=3){const x=p,_=p+1,y=p+2;i=to(this,o,t,n,l,h,d,x,_,y),i&&(i.faceIndex=Math.floor(p/3),e.push(i))}}}}function pf(r,t,e,n,i,s,o,a){let c;if(t.side===sn?c=n.intersectTriangle(o,s,i,!0,a):c=n.intersectTriangle(i,s,o,t.side===Bi,a),c===null)return null;Qr.copy(a),Qr.applyMatrix4(r.matrixWorld);const l=e.ray.origin.distanceTo(Qr);return l<e.near||l>e.far?null:{distance:l,point:Qr.clone(),object:r}}function to(r,t,e,n,i,s,o,a,c,l){r.getVertexPosition(a,$r),r.getVertexPosition(c,Kr),r.getVertexPosition(l,Zr);const h=pf(r,t,e,n,$r,Kr,Zr,Sh);if(h){const d=new A;Ln.getBarycoord(Sh,$r,Kr,Zr,d),i&&(h.uv=Ln.getInterpolatedAttribute(i,a,c,l,d,new ct)),s&&(h.uv1=Ln.getInterpolatedAttribute(s,a,c,l,d,new ct)),o&&(h.normal=Ln.getInterpolatedAttribute(o,a,c,l,d,new A),h.normal.dot(n.direction)>0&&h.normal.multiplyScalar(-1));const f={a,b:c,c:l,normal:new A,materialIndex:0};Ln.getNormal($r,Kr,Zr,f.normal),h.face=f,h.barycoord=d}return h}class Vn extends ge{constructor(t=1,e=1,n=1,i=1,s=1,o=1){super(),this.type="BoxGeometry",this.parameters={width:t,height:e,depth:n,widthSegments:i,heightSegments:s,depthSegments:o};const a=this;i=Math.floor(i),s=Math.floor(s),o=Math.floor(o);const c=[],l=[],h=[],d=[];let f=0,u=0;m("z","y","x",-1,-1,n,e,t,o,s,0),m("z","y","x",1,-1,n,e,-t,o,s,1),m("x","z","y",1,1,t,n,e,i,o,2),m("x","z","y",1,-1,t,n,-e,i,o,3),m("x","y","z",1,-1,t,e,n,i,s,4),m("x","y","z",-1,-1,t,e,-n,i,s,5),this.setIndex(c),this.setAttribute("position",new $t(l,3)),this.setAttribute("normal",new $t(h,3)),this.setAttribute("uv",new $t(d,2));function m(v,p,g,x,_,y,w,T,R,E,D){const M=y/R,S=w/E,k=y/2,N=w/2,z=T/2,H=R+1,L=E+1;let V=0,O=0;const P=new A;for(let B=0;B<L;B++){const G=B*S-N;for(let Q=0;Q<H;Q++){const ut=Q*M-k;P[v]=ut*x,P[p]=G*_,P[g]=z,l.push(P.x,P.y,P.z),P[v]=0,P[p]=0,P[g]=T>0?1:-1,h.push(P.x,P.y,P.z),d.push(Q/R),d.push(1-B/E),V+=1}}for(let B=0;B<E;B++)for(let G=0;G<R;G++){const Q=f+G+H*B,ut=f+G+H*(B+1),X=f+(G+1)+H*(B+1),Z=f+(G+1)+H*B;c.push(Q,ut,Z),c.push(ut,X,Z),O+=6}a.addGroup(u,O,D),u+=O,f+=V}}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}static fromJSON(t){return new Vn(t.width,t.height,t.depth,t.widthSegments,t.heightSegments,t.depthSegments)}}function Ws(r){const t={};for(const e in r){t[e]={};for(const n in r[e]){const i=r[e][n];i&&(i.isColor||i.isMatrix3||i.isMatrix4||i.isVector2||i.isVector3||i.isVector4||i.isTexture||i.isQuaternion)?i.isRenderTargetTexture?(console.warn("UniformsUtils: Textures of render targets cannot be cloned via cloneUniforms() or mergeUniforms()."),t[e][n]=null):t[e][n]=i.clone():Array.isArray(i)?t[e][n]=i.slice():t[e][n]=i}}return t}function an(r){const t={};for(let e=0;e<r.length;e++){const n=Ws(r[e]);for(const i in n)t[i]=n[i]}return t}function mf(r){const t=[];for(let e=0;e<r.length;e++)t.push(r[e].clone());return t}function p0(r){const t=r.getRenderTarget();return t===null?r.outputColorSpace:t.isXRRenderTarget===!0?t.texture.colorSpace:me.workingColorSpace}const m0={clone:Ws,merge:an};var gf=`void main() {
	gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
}`,vf=`void main() {
	gl_FragColor = vec4( 1.0, 0.0, 0.0, 1.0 );
}`;class Ye extends Gi{constructor(t){super(),this.isShaderMaterial=!0,this.type="ShaderMaterial",this.defines={},this.uniforms={},this.uniformsGroups=[],this.vertexShader=gf,this.fragmentShader=vf,this.linewidth=1,this.wireframe=!1,this.wireframeLinewidth=1,this.fog=!1,this.lights=!1,this.clipping=!1,this.forceSinglePass=!0,this.extensions={clipCullDistance:!1,multiDraw:!1},this.defaultAttributeValues={color:[1,1,1],uv:[0,0],uv1:[0,0]},this.index0AttributeName=void 0,this.uniformsNeedUpdate=!1,this.glslVersion=null,t!==void 0&&this.setValues(t)}copy(t){return super.copy(t),this.fragmentShader=t.fragmentShader,this.vertexShader=t.vertexShader,this.uniforms=Ws(t.uniforms),this.uniformsGroups=mf(t.uniformsGroups),this.defines=Object.assign({},t.defines),this.wireframe=t.wireframe,this.wireframeLinewidth=t.wireframeLinewidth,this.fog=t.fog,this.lights=t.lights,this.clipping=t.clipping,this.extensions=Object.assign({},t.extensions),this.glslVersion=t.glslVersion,this}toJSON(t){const e=super.toJSON(t);e.glslVersion=this.glslVersion,e.uniforms={};for(const i in this.uniforms){const o=this.uniforms[i].value;o&&o.isTexture?e.uniforms[i]={type:"t",value:o.toJSON(t).uuid}:o&&o.isColor?e.uniforms[i]={type:"c",value:o.getHex()}:o&&o.isVector2?e.uniforms[i]={type:"v2",value:o.toArray()}:o&&o.isVector3?e.uniforms[i]={type:"v3",value:o.toArray()}:o&&o.isVector4?e.uniforms[i]={type:"v4",value:o.toArray()}:o&&o.isMatrix3?e.uniforms[i]={type:"m3",value:o.toArray()}:o&&o.isMatrix4?e.uniforms[i]={type:"m4",value:o.toArray()}:e.uniforms[i]={value:o}}Object.keys(this.defines).length>0&&(e.defines=this.defines),e.vertexShader=this.vertexShader,e.fragmentShader=this.fragmentShader,e.lights=this.lights,e.clipping=this.clipping;const n={};for(const i in this.extensions)this.extensions[i]===!0&&(n[i]=!0);return Object.keys(n).length>0&&(e.extensions=n),e}}class g0 extends _e{constructor(){super(),this.isCamera=!0,this.type="Camera",this.matrixWorldInverse=new Dt,this.projectionMatrix=new Dt,this.projectionMatrixInverse=new Dt,this.coordinateSystem=di}copy(t,e){return super.copy(t,e),this.matrixWorldInverse.copy(t.matrixWorldInverse),this.projectionMatrix.copy(t.projectionMatrix),this.projectionMatrixInverse.copy(t.projectionMatrixInverse),this.coordinateSystem=t.coordinateSystem,this}getWorldDirection(t){return super.getWorldDirection(t).negate()}updateMatrixWorld(t){super.updateMatrixWorld(t),this.matrixWorldInverse.copy(this.matrixWorld).invert()}updateWorldMatrix(t,e){super.updateWorldMatrix(t,e),this.matrixWorldInverse.copy(this.matrixWorld).invert()}clone(){return new this.constructor().copy(this)}}const Ei=new A,wh=new ct,Th=new ct;class Cn extends g0{constructor(t=50,e=1,n=.1,i=2e3){super(),this.isPerspectiveCamera=!0,this.type="PerspectiveCamera",this.fov=t,this.zoom=1,this.near=n,this.far=i,this.focus=10,this.aspect=e,this.view=null,this.filmGauge=35,this.filmOffset=0,this.updateProjectionMatrix()}copy(t,e){return super.copy(t,e),this.fov=t.fov,this.zoom=t.zoom,this.near=t.near,this.far=t.far,this.focus=t.focus,this.aspect=t.aspect,this.view=t.view===null?null:Object.assign({},t.view),this.filmGauge=t.filmGauge,this.filmOffset=t.filmOffset,this}setFocalLength(t){const e=.5*this.getFilmHeight()/t;this.fov=Pr*2*Math.atan(e),this.updateProjectionMatrix()}getFocalLength(){const t=Math.tan(wr*.5*this.fov);return .5*this.getFilmHeight()/t}getEffectiveFOV(){return Pr*2*Math.atan(Math.tan(wr*.5*this.fov)/this.zoom)}getFilmWidth(){return this.filmGauge*Math.min(this.aspect,1)}getFilmHeight(){return this.filmGauge/Math.max(this.aspect,1)}getViewBounds(t,e,n){Ei.set(-1,-1,.5).applyMatrix4(this.projectionMatrixInverse),e.set(Ei.x,Ei.y).multiplyScalar(-t/Ei.z),Ei.set(1,1,.5).applyMatrix4(this.projectionMatrixInverse),n.set(Ei.x,Ei.y).multiplyScalar(-t/Ei.z)}getViewSize(t,e){return this.getViewBounds(t,wh,Th),e.subVectors(Th,wh)}setViewOffset(t,e,n,i,s,o){this.aspect=t/e,this.view===null&&(this.view={enabled:!0,fullWidth:1,fullHeight:1,offsetX:0,offsetY:0,width:1,height:1}),this.view.enabled=!0,this.view.fullWidth=t,this.view.fullHeight=e,this.view.offsetX=n,this.view.offsetY=i,this.view.width=s,this.view.height=o,this.updateProjectionMatrix()}clearViewOffset(){this.view!==null&&(this.view.enabled=!1),this.updateProjectionMatrix()}updateProjectionMatrix(){const t=this.near;let e=t*Math.tan(wr*.5*this.fov)/this.zoom,n=2*e,i=this.aspect*n,s=-.5*i;const o=this.view;if(this.view!==null&&this.view.enabled){const c=o.fullWidth,l=o.fullHeight;s+=o.offsetX*i/c,e-=o.offsetY*n/l,i*=o.width/c,n*=o.height/l}const a=this.filmOffset;a!==0&&(s+=t*a/this.getFilmWidth()),this.projectionMatrix.makePerspective(s,s+i,e,e-n,t,this.far,this.coordinateSystem),this.projectionMatrixInverse.copy(this.projectionMatrix).invert()}toJSON(t){const e=super.toJSON(t);return e.object.fov=this.fov,e.object.zoom=this.zoom,e.object.near=this.near,e.object.far=this.far,e.object.focus=this.focus,e.object.aspect=this.aspect,this.view!==null&&(e.object.view=Object.assign({},this.view)),e.object.filmGauge=this.filmGauge,e.object.filmOffset=this.filmOffset,e}}const _s=-90,ys=1;class v0 extends _e{constructor(t,e,n){super(),this.type="CubeCamera",this.renderTarget=n,this.coordinateSystem=null,this.activeMipmapLevel=0;const i=new Cn(_s,ys,t,e);i.layers=this.layers,this.add(i);const s=new Cn(_s,ys,t,e);s.layers=this.layers,this.add(s);const o=new Cn(_s,ys,t,e);o.layers=this.layers,this.add(o);const a=new Cn(_s,ys,t,e);a.layers=this.layers,this.add(a);const c=new Cn(_s,ys,t,e);c.layers=this.layers,this.add(c);const l=new Cn(_s,ys,t,e);l.layers=this.layers,this.add(l)}updateCoordinateSystem(){const t=this.coordinateSystem,e=this.children.concat(),[n,i,s,o,a,c]=e;for(const l of e)this.remove(l);if(t===di)n.up.set(0,1,0),n.lookAt(1,0,0),i.up.set(0,1,0),i.lookAt(-1,0,0),s.up.set(0,0,-1),s.lookAt(0,1,0),o.up.set(0,0,1),o.lookAt(0,-1,0),a.up.set(0,1,0),a.lookAt(0,0,1),c.up.set(0,1,0),c.lookAt(0,0,-1);else if(t===Vo)n.up.set(0,-1,0),n.lookAt(-1,0,0),i.up.set(0,-1,0),i.lookAt(1,0,0),s.up.set(0,0,1),s.lookAt(0,1,0),o.up.set(0,0,-1),o.lookAt(0,-1,0),a.up.set(0,-1,0),a.lookAt(0,0,1),c.up.set(0,-1,0),c.lookAt(0,0,-1);else throw new Error("THREE.CubeCamera.updateCoordinateSystem(): Invalid coordinate system: "+t);for(const l of e)this.add(l),l.updateMatrixWorld()}update(t,e){this.parent===null&&this.updateMatrixWorld();const{renderTarget:n,activeMipmapLevel:i}=this;this.coordinateSystem!==t.coordinateSystem&&(this.coordinateSystem=t.coordinateSystem,this.updateCoordinateSystem());const[s,o,a,c,l,h]=this.children,d=t.getRenderTarget(),f=t.getActiveCubeFace(),u=t.getActiveMipmapLevel(),m=t.xr.enabled;t.xr.enabled=!1;const v=n.texture.generateMipmaps;n.texture.generateMipmaps=!1,t.setRenderTarget(n,0,i),t.render(e,s),t.setRenderTarget(n,1,i),t.render(e,o),t.setRenderTarget(n,2,i),t.render(e,a),t.setRenderTarget(n,3,i),t.render(e,c),t.setRenderTarget(n,4,i),t.render(e,l),n.texture.generateMipmaps=v,t.setRenderTarget(n,5,i),t.render(e,h),t.setRenderTarget(d,f,u),t.xr.enabled=m,n.texture.needsPMREMUpdate=!0}}class x0 extends Ke{constructor(t,e,n,i,s,o,a,c,l,h){t=t!==void 0?t:[],e=e!==void 0?e:Os,super(t,e,n,i,s,o,a,c,l,h),this.isCubeTexture=!0,this.flipY=!1}get images(){return this.image}set images(t){this.image=t}}class _0 extends ei{constructor(t=1,e={}){super(t,t,e),this.isWebGLCubeRenderTarget=!0;const n={width:t,height:t,depth:1},i=[n,n,n,n,n,n];this.texture=new x0(i,e.mapping,e.wrapS,e.wrapT,e.magFilter,e.minFilter,e.format,e.type,e.anisotropy,e.colorSpace),this.texture.isRenderTargetTexture=!0,this.texture.generateMipmaps=e.generateMipmaps!==void 0?e.generateMipmaps:!1,this.texture.minFilter=e.minFilter!==void 0?e.minFilter:bn}fromEquirectangularTexture(t,e){this.texture.type=e.type,this.texture.colorSpace=e.colorSpace,this.texture.generateMipmaps=e.generateMipmaps,this.texture.minFilter=e.minFilter,this.texture.magFilter=e.magFilter;const n={uniforms:{tEquirect:{value:null}},vertexShader:`

				varying vec3 vWorldDirection;

				vec3 transformDirection( in vec3 dir, in mat4 matrix ) {

					return normalize( ( matrix * vec4( dir, 0.0 ) ).xyz );

				}

				void main() {

					vWorldDirection = transformDirection( position, modelMatrix );

					#include <begin_vertex>
					#include <project_vertex>

				}
			`,fragmentShader:`

				uniform sampler2D tEquirect;

				varying vec3 vWorldDirection;

				#include <common>

				void main() {

					vec3 direction = normalize( vWorldDirection );

					vec2 sampleUV = equirectUv( direction );

					gl_FragColor = texture2D( tEquirect, sampleUV );

				}
			`},i=new Vn(5,5,5),s=new Ye({name:"CubemapFromEquirect",uniforms:Ws(n.uniforms),vertexShader:n.vertexShader,fragmentShader:n.fragmentShader,side:sn,blending:jn});s.uniforms.tEquirect.value=e;const o=new Ht(i,s),a=e.minFilter;return e.minFilter===Di&&(e.minFilter=bn),new v0(1,10,this).update(t,o),e.minFilter=a,o.geometry.dispose(),o.material.dispose(),this}clear(t,e,n,i){const s=t.getRenderTarget();for(let o=0;o<6;o++)t.setRenderTarget(this,o),t.clear(e,n,i);t.setRenderTarget(s)}}const Na=new A,xf=new A,_f=new Qt;class Qi{constructor(t=new A(1,0,0),e=0){this.isPlane=!0,this.normal=t,this.constant=e}set(t,e){return this.normal.copy(t),this.constant=e,this}setComponents(t,e,n,i){return this.normal.set(t,e,n),this.constant=i,this}setFromNormalAndCoplanarPoint(t,e){return this.normal.copy(t),this.constant=-e.dot(this.normal),this}setFromCoplanarPoints(t,e,n){const i=Na.subVectors(n,e).cross(xf.subVectors(t,e)).normalize();return this.setFromNormalAndCoplanarPoint(i,t),this}copy(t){return this.normal.copy(t.normal),this.constant=t.constant,this}normalize(){const t=1/this.normal.length();return this.normal.multiplyScalar(t),this.constant*=t,this}negate(){return this.constant*=-1,this.normal.negate(),this}distanceToPoint(t){return this.normal.dot(t)+this.constant}distanceToSphere(t){return this.distanceToPoint(t.center)-t.radius}projectPoint(t,e){return e.copy(t).addScaledVector(this.normal,-this.distanceToPoint(t))}intersectLine(t,e){const n=t.delta(Na),i=this.normal.dot(n);if(i===0)return this.distanceToPoint(t.start)===0?e.copy(t.start):null;const s=-(t.start.dot(this.normal)+this.constant)/i;return s<0||s>1?null:e.copy(t.start).addScaledVector(n,s)}intersectsLine(t){const e=this.distanceToPoint(t.start),n=this.distanceToPoint(t.end);return e<0&&n>0||n<0&&e>0}intersectsBox(t){return t.intersectsPlane(this)}intersectsSphere(t){return t.intersectsPlane(this)}coplanarPoint(t){return t.copy(this.normal).multiplyScalar(-this.constant)}applyMatrix4(t,e){const n=e||_f.getNormalMatrix(t),i=this.coplanarPoint(Na).applyMatrix4(t),s=this.normal.applyMatrix3(n).normalize();return this.constant=-i.dot(s),this}translate(t){return this.constant-=t.dot(this.normal),this}equals(t){return t.normal.equals(this.normal)&&t.constant===this.constant}clone(){return new this.constructor().copy(this)}}const $i=new ni,eo=new A;class Sl{constructor(t=new Qi,e=new Qi,n=new Qi,i=new Qi,s=new Qi,o=new Qi){this.planes=[t,e,n,i,s,o]}set(t,e,n,i,s,o){const a=this.planes;return a[0].copy(t),a[1].copy(e),a[2].copy(n),a[3].copy(i),a[4].copy(s),a[5].copy(o),this}copy(t){const e=this.planes;for(let n=0;n<6;n++)e[n].copy(t.planes[n]);return this}setFromProjectionMatrix(t,e=di){const n=this.planes,i=t.elements,s=i[0],o=i[1],a=i[2],c=i[3],l=i[4],h=i[5],d=i[6],f=i[7],u=i[8],m=i[9],v=i[10],p=i[11],g=i[12],x=i[13],_=i[14],y=i[15];if(n[0].setComponents(c-s,f-l,p-u,y-g).normalize(),n[1].setComponents(c+s,f+l,p+u,y+g).normalize(),n[2].setComponents(c+o,f+h,p+m,y+x).normalize(),n[3].setComponents(c-o,f-h,p-m,y-x).normalize(),n[4].setComponents(c-a,f-d,p-v,y-_).normalize(),e===di)n[5].setComponents(c+a,f+d,p+v,y+_).normalize();else if(e===Vo)n[5].setComponents(a,d,v,_).normalize();else throw new Error("THREE.Frustum.setFromProjectionMatrix(): Invalid coordinate system: "+e);return this}intersectsObject(t){if(t.boundingSphere!==void 0)t.boundingSphere===null&&t.computeBoundingSphere(),$i.copy(t.boundingSphere).applyMatrix4(t.matrixWorld);else{const e=t.geometry;e.boundingSphere===null&&e.computeBoundingSphere(),$i.copy(e.boundingSphere).applyMatrix4(t.matrixWorld)}return this.intersectsSphere($i)}intersectsSprite(t){return $i.center.set(0,0,0),$i.radius=.7071067811865476,$i.applyMatrix4(t.matrixWorld),this.intersectsSphere($i)}intersectsSphere(t){const e=this.planes,n=t.center,i=-t.radius;for(let s=0;s<6;s++)if(e[s].distanceToPoint(n)<i)return!1;return!0}intersectsBox(t){const e=this.planes;for(let n=0;n<6;n++){const i=e[n];if(eo.x=i.normal.x>0?t.max.x:t.min.x,eo.y=i.normal.y>0?t.max.y:t.min.y,eo.z=i.normal.z>0?t.max.z:t.min.z,i.distanceToPoint(eo)<0)return!1}return!0}containsPoint(t){const e=this.planes;for(let n=0;n<6;n++)if(e[n].distanceToPoint(t)<0)return!1;return!0}clone(){return new this.constructor().copy(this)}}function y0(){let r=null,t=!1,e=null,n=null;function i(s,o){e(s,o),n=r.requestAnimationFrame(i)}return{start:function(){t!==!0&&e!==null&&(n=r.requestAnimationFrame(i),t=!0)},stop:function(){r.cancelAnimationFrame(n),t=!1},setAnimationLoop:function(s){e=s},setContext:function(s){r=s}}}function yf(r){const t=new WeakMap;function e(a,c){const l=a.array,h=a.usage,d=l.byteLength,f=r.createBuffer();r.bindBuffer(c,f),r.bufferData(c,l,h),a.onUploadCallback();let u;if(l instanceof Float32Array)u=r.FLOAT;else if(l instanceof Uint16Array)a.isFloat16BufferAttribute?u=r.HALF_FLOAT:u=r.UNSIGNED_SHORT;else if(l instanceof Int16Array)u=r.SHORT;else if(l instanceof Uint32Array)u=r.UNSIGNED_INT;else if(l instanceof Int32Array)u=r.INT;else if(l instanceof Int8Array)u=r.BYTE;else if(l instanceof Uint8Array)u=r.UNSIGNED_BYTE;else if(l instanceof Uint8ClampedArray)u=r.UNSIGNED_BYTE;else throw new Error("THREE.WebGLAttributes: Unsupported buffer data format: "+l);return{buffer:f,type:u,bytesPerElement:l.BYTES_PER_ELEMENT,version:a.version,size:d}}function n(a,c,l){const h=c.array,d=c.updateRanges;if(r.bindBuffer(l,a),d.length===0)r.bufferSubData(l,0,h);else{d.sort((u,m)=>u.start-m.start);let f=0;for(let u=1;u<d.length;u++){const m=d[f],v=d[u];v.start<=m.start+m.count+1?m.count=Math.max(m.count,v.start+v.count-m.start):(++f,d[f]=v)}d.length=f+1;for(let u=0,m=d.length;u<m;u++){const v=d[u];r.bufferSubData(l,v.start*h.BYTES_PER_ELEMENT,h,v.start,v.count)}c.clearUpdateRanges()}c.onUploadCallback()}function i(a){return a.isInterleavedBufferAttribute&&(a=a.data),t.get(a)}function s(a){a.isInterleavedBufferAttribute&&(a=a.data);const c=t.get(a);c&&(r.deleteBuffer(c.buffer),t.delete(a))}function o(a,c){if(a.isInterleavedBufferAttribute&&(a=a.data),a.isGLBufferAttribute){const h=t.get(a);(!h||h.version<a.version)&&t.set(a,{buffer:a.buffer,type:a.type,bytesPerElement:a.elementSize,version:a.version});return}const l=t.get(a);if(l===void 0)t.set(a,e(a,c));else if(l.version<a.version){if(l.size!==a.array.byteLength)throw new Error("THREE.WebGLAttributes: The size of the buffer attribute's array buffer does not match the original size. Resizing buffer attributes is not supported.");n(l.buffer,a,c),l.version=a.version}}return{get:i,remove:s,update:o}}class vi extends ge{constructor(t=1,e=1,n=1,i=1){super(),this.type="PlaneGeometry",this.parameters={width:t,height:e,widthSegments:n,heightSegments:i};const s=t/2,o=e/2,a=Math.floor(n),c=Math.floor(i),l=a+1,h=c+1,d=t/a,f=e/c,u=[],m=[],v=[],p=[];for(let g=0;g<h;g++){const x=g*f-o;for(let _=0;_<l;_++){const y=_*d-s;m.push(y,-x,0),v.push(0,0,1),p.push(_/a),p.push(1-g/c)}}for(let g=0;g<c;g++)for(let x=0;x<a;x++){const _=x+l*g,y=x+l*(g+1),w=x+1+l*(g+1),T=x+1+l*g;u.push(_,y,T),u.push(y,w,T)}this.setIndex(u),this.setAttribute("position",new $t(m,3)),this.setAttribute("normal",new $t(v,3)),this.setAttribute("uv",new $t(p,2))}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}static fromJSON(t){return new vi(t.width,t.height,t.widthSegments,t.heightSegments)}}var Mf=`#ifdef USE_ALPHAHASH
	if ( diffuseColor.a < getAlphaHashThreshold( vPosition ) ) discard;
#endif`,bf=`#ifdef USE_ALPHAHASH
	const float ALPHA_HASH_SCALE = 0.05;
	float hash2D( vec2 value ) {
		return fract( 1.0e4 * sin( 17.0 * value.x + 0.1 * value.y ) * ( 0.1 + abs( sin( 13.0 * value.y + value.x ) ) ) );
	}
	float hash3D( vec3 value ) {
		return hash2D( vec2( hash2D( value.xy ), value.z ) );
	}
	float getAlphaHashThreshold( vec3 position ) {
		float maxDeriv = max(
			length( dFdx( position.xyz ) ),
			length( dFdy( position.xyz ) )
		);
		float pixScale = 1.0 / ( ALPHA_HASH_SCALE * maxDeriv );
		vec2 pixScales = vec2(
			exp2( floor( log2( pixScale ) ) ),
			exp2( ceil( log2( pixScale ) ) )
		);
		vec2 alpha = vec2(
			hash3D( floor( pixScales.x * position.xyz ) ),
			hash3D( floor( pixScales.y * position.xyz ) )
		);
		float lerpFactor = fract( log2( pixScale ) );
		float x = ( 1.0 - lerpFactor ) * alpha.x + lerpFactor * alpha.y;
		float a = min( lerpFactor, 1.0 - lerpFactor );
		vec3 cases = vec3(
			x * x / ( 2.0 * a * ( 1.0 - a ) ),
			( x - 0.5 * a ) / ( 1.0 - a ),
			1.0 - ( ( 1.0 - x ) * ( 1.0 - x ) / ( 2.0 * a * ( 1.0 - a ) ) )
		);
		float threshold = ( x < ( 1.0 - a ) )
			? ( ( x < a ) ? cases.x : cases.y )
			: cases.z;
		return clamp( threshold , 1.0e-6, 1.0 );
	}
#endif`,Sf=`#ifdef USE_ALPHAMAP
	diffuseColor.a *= texture2D( alphaMap, vAlphaMapUv ).g;
#endif`,wf=`#ifdef USE_ALPHAMAP
	uniform sampler2D alphaMap;
#endif`,Tf=`#ifdef USE_ALPHATEST
	#ifdef ALPHA_TO_COVERAGE
	diffuseColor.a = smoothstep( alphaTest, alphaTest + fwidth( diffuseColor.a ), diffuseColor.a );
	if ( diffuseColor.a == 0.0 ) discard;
	#else
	if ( diffuseColor.a < alphaTest ) discard;
	#endif
#endif`,Ef=`#ifdef USE_ALPHATEST
	uniform float alphaTest;
#endif`,Af=`#ifdef USE_AOMAP
	float ambientOcclusion = ( texture2D( aoMap, vAoMapUv ).r - 1.0 ) * aoMapIntensity + 1.0;
	reflectedLight.indirectDiffuse *= ambientOcclusion;
	#if defined( USE_CLEARCOAT ) 
		clearcoatSpecularIndirect *= ambientOcclusion;
	#endif
	#if defined( USE_SHEEN ) 
		sheenSpecularIndirect *= ambientOcclusion;
	#endif
	#if defined( USE_ENVMAP ) && defined( STANDARD )
		float dotNV = saturate( dot( geometryNormal, geometryViewDir ) );
		reflectedLight.indirectSpecular *= computeSpecularOcclusion( dotNV, ambientOcclusion, material.roughness );
	#endif
#endif`,Rf=`#ifdef USE_AOMAP
	uniform sampler2D aoMap;
	uniform float aoMapIntensity;
#endif`,Cf=`#ifdef USE_BATCHING
	#if ! defined( GL_ANGLE_multi_draw )
	#define gl_DrawID _gl_DrawID
	uniform int _gl_DrawID;
	#endif
	uniform highp sampler2D batchingTexture;
	uniform highp usampler2D batchingIdTexture;
	mat4 getBatchingMatrix( const in float i ) {
		int size = textureSize( batchingTexture, 0 ).x;
		int j = int( i ) * 4;
		int x = j % size;
		int y = j / size;
		vec4 v1 = texelFetch( batchingTexture, ivec2( x, y ), 0 );
		vec4 v2 = texelFetch( batchingTexture, ivec2( x + 1, y ), 0 );
		vec4 v3 = texelFetch( batchingTexture, ivec2( x + 2, y ), 0 );
		vec4 v4 = texelFetch( batchingTexture, ivec2( x + 3, y ), 0 );
		return mat4( v1, v2, v3, v4 );
	}
	float getIndirectIndex( const in int i ) {
		int size = textureSize( batchingIdTexture, 0 ).x;
		int x = i % size;
		int y = i / size;
		return float( texelFetch( batchingIdTexture, ivec2( x, y ), 0 ).r );
	}
#endif
#ifdef USE_BATCHING_COLOR
	uniform sampler2D batchingColorTexture;
	vec3 getBatchingColor( const in float i ) {
		int size = textureSize( batchingColorTexture, 0 ).x;
		int j = int( i );
		int x = j % size;
		int y = j / size;
		return texelFetch( batchingColorTexture, ivec2( x, y ), 0 ).rgb;
	}
#endif`,Pf=`#ifdef USE_BATCHING
	mat4 batchingMatrix = getBatchingMatrix( getIndirectIndex( gl_DrawID ) );
#endif`,Lf=`vec3 transformed = vec3( position );
#ifdef USE_ALPHAHASH
	vPosition = vec3( position );
#endif`,kf=`vec3 objectNormal = vec3( normal );
#ifdef USE_TANGENT
	vec3 objectTangent = vec3( tangent.xyz );
#endif`,Df=`float G_BlinnPhong_Implicit( ) {
	return 0.25;
}
float D_BlinnPhong( const in float shininess, const in float dotNH ) {
	return RECIPROCAL_PI * ( shininess * 0.5 + 1.0 ) * pow( dotNH, shininess );
}
vec3 BRDF_BlinnPhong( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in vec3 specularColor, const in float shininess ) {
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNH = saturate( dot( normal, halfDir ) );
	float dotVH = saturate( dot( viewDir, halfDir ) );
	vec3 F = F_Schlick( specularColor, 1.0, dotVH );
	float G = G_BlinnPhong_Implicit( );
	float D = D_BlinnPhong( shininess, dotNH );
	return F * ( G * D );
} // validated`,If=`#ifdef USE_IRIDESCENCE
	const mat3 XYZ_TO_REC709 = mat3(
		 3.2404542, -0.9692660,  0.0556434,
		-1.5371385,  1.8760108, -0.2040259,
		-0.4985314,  0.0415560,  1.0572252
	);
	vec3 Fresnel0ToIor( vec3 fresnel0 ) {
		vec3 sqrtF0 = sqrt( fresnel0 );
		return ( vec3( 1.0 ) + sqrtF0 ) / ( vec3( 1.0 ) - sqrtF0 );
	}
	vec3 IorToFresnel0( vec3 transmittedIor, float incidentIor ) {
		return pow2( ( transmittedIor - vec3( incidentIor ) ) / ( transmittedIor + vec3( incidentIor ) ) );
	}
	float IorToFresnel0( float transmittedIor, float incidentIor ) {
		return pow2( ( transmittedIor - incidentIor ) / ( transmittedIor + incidentIor ));
	}
	vec3 evalSensitivity( float OPD, vec3 shift ) {
		float phase = 2.0 * PI * OPD * 1.0e-9;
		vec3 val = vec3( 5.4856e-13, 4.4201e-13, 5.2481e-13 );
		vec3 pos = vec3( 1.6810e+06, 1.7953e+06, 2.2084e+06 );
		vec3 var = vec3( 4.3278e+09, 9.3046e+09, 6.6121e+09 );
		vec3 xyz = val * sqrt( 2.0 * PI * var ) * cos( pos * phase + shift ) * exp( - pow2( phase ) * var );
		xyz.x += 9.7470e-14 * sqrt( 2.0 * PI * 4.5282e+09 ) * cos( 2.2399e+06 * phase + shift[ 0 ] ) * exp( - 4.5282e+09 * pow2( phase ) );
		xyz /= 1.0685e-7;
		vec3 rgb = XYZ_TO_REC709 * xyz;
		return rgb;
	}
	vec3 evalIridescence( float outsideIOR, float eta2, float cosTheta1, float thinFilmThickness, vec3 baseF0 ) {
		vec3 I;
		float iridescenceIOR = mix( outsideIOR, eta2, smoothstep( 0.0, 0.03, thinFilmThickness ) );
		float sinTheta2Sq = pow2( outsideIOR / iridescenceIOR ) * ( 1.0 - pow2( cosTheta1 ) );
		float cosTheta2Sq = 1.0 - sinTheta2Sq;
		if ( cosTheta2Sq < 0.0 ) {
			return vec3( 1.0 );
		}
		float cosTheta2 = sqrt( cosTheta2Sq );
		float R0 = IorToFresnel0( iridescenceIOR, outsideIOR );
		float R12 = F_Schlick( R0, 1.0, cosTheta1 );
		float T121 = 1.0 - R12;
		float phi12 = 0.0;
		if ( iridescenceIOR < outsideIOR ) phi12 = PI;
		float phi21 = PI - phi12;
		vec3 baseIOR = Fresnel0ToIor( clamp( baseF0, 0.0, 0.9999 ) );		vec3 R1 = IorToFresnel0( baseIOR, iridescenceIOR );
		vec3 R23 = F_Schlick( R1, 1.0, cosTheta2 );
		vec3 phi23 = vec3( 0.0 );
		if ( baseIOR[ 0 ] < iridescenceIOR ) phi23[ 0 ] = PI;
		if ( baseIOR[ 1 ] < iridescenceIOR ) phi23[ 1 ] = PI;
		if ( baseIOR[ 2 ] < iridescenceIOR ) phi23[ 2 ] = PI;
		float OPD = 2.0 * iridescenceIOR * thinFilmThickness * cosTheta2;
		vec3 phi = vec3( phi21 ) + phi23;
		vec3 R123 = clamp( R12 * R23, 1e-5, 0.9999 );
		vec3 r123 = sqrt( R123 );
		vec3 Rs = pow2( T121 ) * R23 / ( vec3( 1.0 ) - R123 );
		vec3 C0 = R12 + Rs;
		I = C0;
		vec3 Cm = Rs - T121;
		for ( int m = 1; m <= 2; ++ m ) {
			Cm *= r123;
			vec3 Sm = 2.0 * evalSensitivity( float( m ) * OPD, float( m ) * phi );
			I += Cm * Sm;
		}
		return max( I, vec3( 0.0 ) );
	}
#endif`,Nf=`#ifdef USE_BUMPMAP
	uniform sampler2D bumpMap;
	uniform float bumpScale;
	vec2 dHdxy_fwd() {
		vec2 dSTdx = dFdx( vBumpMapUv );
		vec2 dSTdy = dFdy( vBumpMapUv );
		float Hll = bumpScale * texture2D( bumpMap, vBumpMapUv ).x;
		float dBx = bumpScale * texture2D( bumpMap, vBumpMapUv + dSTdx ).x - Hll;
		float dBy = bumpScale * texture2D( bumpMap, vBumpMapUv + dSTdy ).x - Hll;
		return vec2( dBx, dBy );
	}
	vec3 perturbNormalArb( vec3 surf_pos, vec3 surf_norm, vec2 dHdxy, float faceDirection ) {
		vec3 vSigmaX = normalize( dFdx( surf_pos.xyz ) );
		vec3 vSigmaY = normalize( dFdy( surf_pos.xyz ) );
		vec3 vN = surf_norm;
		vec3 R1 = cross( vSigmaY, vN );
		vec3 R2 = cross( vN, vSigmaX );
		float fDet = dot( vSigmaX, R1 ) * faceDirection;
		vec3 vGrad = sign( fDet ) * ( dHdxy.x * R1 + dHdxy.y * R2 );
		return normalize( abs( fDet ) * surf_norm - vGrad );
	}
#endif`,Uf=`#if NUM_CLIPPING_PLANES > 0
	vec4 plane;
	#ifdef ALPHA_TO_COVERAGE
		float distanceToPlane, distanceGradient;
		float clipOpacity = 1.0;
		#pragma unroll_loop_start
		for ( int i = 0; i < UNION_CLIPPING_PLANES; i ++ ) {
			plane = clippingPlanes[ i ];
			distanceToPlane = - dot( vClipPosition, plane.xyz ) + plane.w;
			distanceGradient = fwidth( distanceToPlane ) / 2.0;
			clipOpacity *= smoothstep( - distanceGradient, distanceGradient, distanceToPlane );
			if ( clipOpacity == 0.0 ) discard;
		}
		#pragma unroll_loop_end
		#if UNION_CLIPPING_PLANES < NUM_CLIPPING_PLANES
			float unionClipOpacity = 1.0;
			#pragma unroll_loop_start
			for ( int i = UNION_CLIPPING_PLANES; i < NUM_CLIPPING_PLANES; i ++ ) {
				plane = clippingPlanes[ i ];
				distanceToPlane = - dot( vClipPosition, plane.xyz ) + plane.w;
				distanceGradient = fwidth( distanceToPlane ) / 2.0;
				unionClipOpacity *= 1.0 - smoothstep( - distanceGradient, distanceGradient, distanceToPlane );
			}
			#pragma unroll_loop_end
			clipOpacity *= 1.0 - unionClipOpacity;
		#endif
		diffuseColor.a *= clipOpacity;
		if ( diffuseColor.a == 0.0 ) discard;
	#else
		#pragma unroll_loop_start
		for ( int i = 0; i < UNION_CLIPPING_PLANES; i ++ ) {
			plane = clippingPlanes[ i ];
			if ( dot( vClipPosition, plane.xyz ) > plane.w ) discard;
		}
		#pragma unroll_loop_end
		#if UNION_CLIPPING_PLANES < NUM_CLIPPING_PLANES
			bool clipped = true;
			#pragma unroll_loop_start
			for ( int i = UNION_CLIPPING_PLANES; i < NUM_CLIPPING_PLANES; i ++ ) {
				plane = clippingPlanes[ i ];
				clipped = ( dot( vClipPosition, plane.xyz ) > plane.w ) && clipped;
			}
			#pragma unroll_loop_end
			if ( clipped ) discard;
		#endif
	#endif
#endif`,zf=`#if NUM_CLIPPING_PLANES > 0
	varying vec3 vClipPosition;
	uniform vec4 clippingPlanes[ NUM_CLIPPING_PLANES ];
#endif`,Ff=`#if NUM_CLIPPING_PLANES > 0
	varying vec3 vClipPosition;
#endif`,Bf=`#if NUM_CLIPPING_PLANES > 0
	vClipPosition = - mvPosition.xyz;
#endif`,Of=`#if defined( USE_COLOR_ALPHA )
	diffuseColor *= vColor;
#elif defined( USE_COLOR )
	diffuseColor.rgb *= vColor;
#endif`,Hf=`#if defined( USE_COLOR_ALPHA )
	varying vec4 vColor;
#elif defined( USE_COLOR )
	varying vec3 vColor;
#endif`,Vf=`#if defined( USE_COLOR_ALPHA )
	varying vec4 vColor;
#elif defined( USE_COLOR ) || defined( USE_INSTANCING_COLOR ) || defined( USE_BATCHING_COLOR )
	varying vec3 vColor;
#endif`,Gf=`#if defined( USE_COLOR_ALPHA )
	vColor = vec4( 1.0 );
#elif defined( USE_COLOR ) || defined( USE_INSTANCING_COLOR ) || defined( USE_BATCHING_COLOR )
	vColor = vec3( 1.0 );
#endif
#ifdef USE_COLOR
	vColor *= color;
#endif
#ifdef USE_INSTANCING_COLOR
	vColor.xyz *= instanceColor.xyz;
#endif
#ifdef USE_BATCHING_COLOR
	vec3 batchingColor = getBatchingColor( getIndirectIndex( gl_DrawID ) );
	vColor.xyz *= batchingColor.xyz;
#endif`,Wf=`#define PI 3.141592653589793
#define PI2 6.283185307179586
#define PI_HALF 1.5707963267948966
#define RECIPROCAL_PI 0.3183098861837907
#define RECIPROCAL_PI2 0.15915494309189535
#define EPSILON 1e-6
#ifndef saturate
#define saturate( a ) clamp( a, 0.0, 1.0 )
#endif
#define whiteComplement( a ) ( 1.0 - saturate( a ) )
float pow2( const in float x ) { return x*x; }
vec3 pow2( const in vec3 x ) { return x*x; }
float pow3( const in float x ) { return x*x*x; }
float pow4( const in float x ) { float x2 = x*x; return x2*x2; }
float max3( const in vec3 v ) { return max( max( v.x, v.y ), v.z ); }
float average( const in vec3 v ) { return dot( v, vec3( 0.3333333 ) ); }
highp float rand( const in vec2 uv ) {
	const highp float a = 12.9898, b = 78.233, c = 43758.5453;
	highp float dt = dot( uv.xy, vec2( a,b ) ), sn = mod( dt, PI );
	return fract( sin( sn ) * c );
}
#ifdef HIGH_PRECISION
	float precisionSafeLength( vec3 v ) { return length( v ); }
#else
	float precisionSafeLength( vec3 v ) {
		float maxComponent = max3( abs( v ) );
		return length( v / maxComponent ) * maxComponent;
	}
#endif
struct IncidentLight {
	vec3 color;
	vec3 direction;
	bool visible;
};
struct ReflectedLight {
	vec3 directDiffuse;
	vec3 directSpecular;
	vec3 indirectDiffuse;
	vec3 indirectSpecular;
};
#ifdef USE_ALPHAHASH
	varying vec3 vPosition;
#endif
vec3 transformDirection( in vec3 dir, in mat4 matrix ) {
	return normalize( ( matrix * vec4( dir, 0.0 ) ).xyz );
}
vec3 inverseTransformDirection( in vec3 dir, in mat4 matrix ) {
	return normalize( ( vec4( dir, 0.0 ) * matrix ).xyz );
}
mat3 transposeMat3( const in mat3 m ) {
	mat3 tmp;
	tmp[ 0 ] = vec3( m[ 0 ].x, m[ 1 ].x, m[ 2 ].x );
	tmp[ 1 ] = vec3( m[ 0 ].y, m[ 1 ].y, m[ 2 ].y );
	tmp[ 2 ] = vec3( m[ 0 ].z, m[ 1 ].z, m[ 2 ].z );
	return tmp;
}
bool isPerspectiveMatrix( mat4 m ) {
	return m[ 2 ][ 3 ] == - 1.0;
}
vec2 equirectUv( in vec3 dir ) {
	float u = atan( dir.z, dir.x ) * RECIPROCAL_PI2 + 0.5;
	float v = asin( clamp( dir.y, - 1.0, 1.0 ) ) * RECIPROCAL_PI + 0.5;
	return vec2( u, v );
}
vec3 BRDF_Lambert( const in vec3 diffuseColor ) {
	return RECIPROCAL_PI * diffuseColor;
}
vec3 F_Schlick( const in vec3 f0, const in float f90, const in float dotVH ) {
	float fresnel = exp2( ( - 5.55473 * dotVH - 6.98316 ) * dotVH );
	return f0 * ( 1.0 - fresnel ) + ( f90 * fresnel );
}
float F_Schlick( const in float f0, const in float f90, const in float dotVH ) {
	float fresnel = exp2( ( - 5.55473 * dotVH - 6.98316 ) * dotVH );
	return f0 * ( 1.0 - fresnel ) + ( f90 * fresnel );
} // validated`,qf=`#ifdef ENVMAP_TYPE_CUBE_UV
	#define cubeUV_minMipLevel 4.0
	#define cubeUV_minTileSize 16.0
	float getFace( vec3 direction ) {
		vec3 absDirection = abs( direction );
		float face = - 1.0;
		if ( absDirection.x > absDirection.z ) {
			if ( absDirection.x > absDirection.y )
				face = direction.x > 0.0 ? 0.0 : 3.0;
			else
				face = direction.y > 0.0 ? 1.0 : 4.0;
		} else {
			if ( absDirection.z > absDirection.y )
				face = direction.z > 0.0 ? 2.0 : 5.0;
			else
				face = direction.y > 0.0 ? 1.0 : 4.0;
		}
		return face;
	}
	vec2 getUV( vec3 direction, float face ) {
		vec2 uv;
		if ( face == 0.0 ) {
			uv = vec2( direction.z, direction.y ) / abs( direction.x );
		} else if ( face == 1.0 ) {
			uv = vec2( - direction.x, - direction.z ) / abs( direction.y );
		} else if ( face == 2.0 ) {
			uv = vec2( - direction.x, direction.y ) / abs( direction.z );
		} else if ( face == 3.0 ) {
			uv = vec2( - direction.z, direction.y ) / abs( direction.x );
		} else if ( face == 4.0 ) {
			uv = vec2( - direction.x, direction.z ) / abs( direction.y );
		} else {
			uv = vec2( direction.x, direction.y ) / abs( direction.z );
		}
		return 0.5 * ( uv + 1.0 );
	}
	vec3 bilinearCubeUV( sampler2D envMap, vec3 direction, float mipInt ) {
		float face = getFace( direction );
		float filterInt = max( cubeUV_minMipLevel - mipInt, 0.0 );
		mipInt = max( mipInt, cubeUV_minMipLevel );
		float faceSize = exp2( mipInt );
		highp vec2 uv = getUV( direction, face ) * ( faceSize - 2.0 ) + 1.0;
		if ( face > 2.0 ) {
			uv.y += faceSize;
			face -= 3.0;
		}
		uv.x += face * faceSize;
		uv.x += filterInt * 3.0 * cubeUV_minTileSize;
		uv.y += 4.0 * ( exp2( CUBEUV_MAX_MIP ) - faceSize );
		uv.x *= CUBEUV_TEXEL_WIDTH;
		uv.y *= CUBEUV_TEXEL_HEIGHT;
		#ifdef texture2DGradEXT
			return texture2DGradEXT( envMap, uv, vec2( 0.0 ), vec2( 0.0 ) ).rgb;
		#else
			return texture2D( envMap, uv ).rgb;
		#endif
	}
	#define cubeUV_r0 1.0
	#define cubeUV_m0 - 2.0
	#define cubeUV_r1 0.8
	#define cubeUV_m1 - 1.0
	#define cubeUV_r4 0.4
	#define cubeUV_m4 2.0
	#define cubeUV_r5 0.305
	#define cubeUV_m5 3.0
	#define cubeUV_r6 0.21
	#define cubeUV_m6 4.0
	float roughnessToMip( float roughness ) {
		float mip = 0.0;
		if ( roughness >= cubeUV_r1 ) {
			mip = ( cubeUV_r0 - roughness ) * ( cubeUV_m1 - cubeUV_m0 ) / ( cubeUV_r0 - cubeUV_r1 ) + cubeUV_m0;
		} else if ( roughness >= cubeUV_r4 ) {
			mip = ( cubeUV_r1 - roughness ) * ( cubeUV_m4 - cubeUV_m1 ) / ( cubeUV_r1 - cubeUV_r4 ) + cubeUV_m1;
		} else if ( roughness >= cubeUV_r5 ) {
			mip = ( cubeUV_r4 - roughness ) * ( cubeUV_m5 - cubeUV_m4 ) / ( cubeUV_r4 - cubeUV_r5 ) + cubeUV_m4;
		} else if ( roughness >= cubeUV_r6 ) {
			mip = ( cubeUV_r5 - roughness ) * ( cubeUV_m6 - cubeUV_m5 ) / ( cubeUV_r5 - cubeUV_r6 ) + cubeUV_m5;
		} else {
			mip = - 2.0 * log2( 1.16 * roughness );		}
		return mip;
	}
	vec4 textureCubeUV( sampler2D envMap, vec3 sampleDir, float roughness ) {
		float mip = clamp( roughnessToMip( roughness ), cubeUV_m0, CUBEUV_MAX_MIP );
		float mipF = fract( mip );
		float mipInt = floor( mip );
		vec3 color0 = bilinearCubeUV( envMap, sampleDir, mipInt );
		if ( mipF == 0.0 ) {
			return vec4( color0, 1.0 );
		} else {
			vec3 color1 = bilinearCubeUV( envMap, sampleDir, mipInt + 1.0 );
			return vec4( mix( color0, color1, mipF ), 1.0 );
		}
	}
#endif`,Xf=`vec3 transformedNormal = objectNormal;
#ifdef USE_TANGENT
	vec3 transformedTangent = objectTangent;
#endif
#ifdef USE_BATCHING
	mat3 bm = mat3( batchingMatrix );
	transformedNormal /= vec3( dot( bm[ 0 ], bm[ 0 ] ), dot( bm[ 1 ], bm[ 1 ] ), dot( bm[ 2 ], bm[ 2 ] ) );
	transformedNormal = bm * transformedNormal;
	#ifdef USE_TANGENT
		transformedTangent = bm * transformedTangent;
	#endif
#endif
#ifdef USE_INSTANCING
	mat3 im = mat3( instanceMatrix );
	transformedNormal /= vec3( dot( im[ 0 ], im[ 0 ] ), dot( im[ 1 ], im[ 1 ] ), dot( im[ 2 ], im[ 2 ] ) );
	transformedNormal = im * transformedNormal;
	#ifdef USE_TANGENT
		transformedTangent = im * transformedTangent;
	#endif
#endif
transformedNormal = normalMatrix * transformedNormal;
#ifdef FLIP_SIDED
	transformedNormal = - transformedNormal;
#endif
#ifdef USE_TANGENT
	transformedTangent = ( modelViewMatrix * vec4( transformedTangent, 0.0 ) ).xyz;
	#ifdef FLIP_SIDED
		transformedTangent = - transformedTangent;
	#endif
#endif`,jf=`#ifdef USE_DISPLACEMENTMAP
	uniform sampler2D displacementMap;
	uniform float displacementScale;
	uniform float displacementBias;
#endif`,Yf=`#ifdef USE_DISPLACEMENTMAP
	transformed += normalize( objectNormal ) * ( texture2D( displacementMap, vDisplacementMapUv ).x * displacementScale + displacementBias );
#endif`,$f=`#ifdef USE_EMISSIVEMAP
	vec4 emissiveColor = texture2D( emissiveMap, vEmissiveMapUv );
	totalEmissiveRadiance *= emissiveColor.rgb;
#endif`,Kf=`#ifdef USE_EMISSIVEMAP
	uniform sampler2D emissiveMap;
#endif`,Zf="gl_FragColor = linearToOutputTexel( gl_FragColor );",Jf=`
const mat3 LINEAR_SRGB_TO_LINEAR_DISPLAY_P3 = mat3(
	vec3( 0.8224621, 0.177538, 0.0 ),
	vec3( 0.0331941, 0.9668058, 0.0 ),
	vec3( 0.0170827, 0.0723974, 0.9105199 )
);
const mat3 LINEAR_DISPLAY_P3_TO_LINEAR_SRGB = mat3(
	vec3( 1.2249401, - 0.2249404, 0.0 ),
	vec3( - 0.0420569, 1.0420571, 0.0 ),
	vec3( - 0.0196376, - 0.0786361, 1.0982735 )
);
vec4 LinearSRGBToLinearDisplayP3( in vec4 value ) {
	return vec4( value.rgb * LINEAR_SRGB_TO_LINEAR_DISPLAY_P3, value.a );
}
vec4 LinearDisplayP3ToLinearSRGB( in vec4 value ) {
	return vec4( value.rgb * LINEAR_DISPLAY_P3_TO_LINEAR_SRGB, value.a );
}
vec4 LinearTransferOETF( in vec4 value ) {
	return value;
}
vec4 sRGBTransferOETF( in vec4 value ) {
	return vec4( mix( pow( value.rgb, vec3( 0.41666 ) ) * 1.055 - vec3( 0.055 ), value.rgb * 12.92, vec3( lessThanEqual( value.rgb, vec3( 0.0031308 ) ) ) ), value.a );
}`,Qf=`#ifdef USE_ENVMAP
	#ifdef ENV_WORLDPOS
		vec3 cameraToFrag;
		if ( isOrthographic ) {
			cameraToFrag = normalize( vec3( - viewMatrix[ 0 ][ 2 ], - viewMatrix[ 1 ][ 2 ], - viewMatrix[ 2 ][ 2 ] ) );
		} else {
			cameraToFrag = normalize( vWorldPosition - cameraPosition );
		}
		vec3 worldNormal = inverseTransformDirection( normal, viewMatrix );
		#ifdef ENVMAP_MODE_REFLECTION
			vec3 reflectVec = reflect( cameraToFrag, worldNormal );
		#else
			vec3 reflectVec = refract( cameraToFrag, worldNormal, refractionRatio );
		#endif
	#else
		vec3 reflectVec = vReflect;
	#endif
	#ifdef ENVMAP_TYPE_CUBE
		vec4 envColor = textureCube( envMap, envMapRotation * vec3( flipEnvMap * reflectVec.x, reflectVec.yz ) );
	#else
		vec4 envColor = vec4( 0.0 );
	#endif
	#ifdef ENVMAP_BLENDING_MULTIPLY
		outgoingLight = mix( outgoingLight, outgoingLight * envColor.xyz, specularStrength * reflectivity );
	#elif defined( ENVMAP_BLENDING_MIX )
		outgoingLight = mix( outgoingLight, envColor.xyz, specularStrength * reflectivity );
	#elif defined( ENVMAP_BLENDING_ADD )
		outgoingLight += envColor.xyz * specularStrength * reflectivity;
	#endif
#endif`,tp=`#ifdef USE_ENVMAP
	uniform float envMapIntensity;
	uniform float flipEnvMap;
	uniform mat3 envMapRotation;
	#ifdef ENVMAP_TYPE_CUBE
		uniform samplerCube envMap;
	#else
		uniform sampler2D envMap;
	#endif
	
#endif`,ep=`#ifdef USE_ENVMAP
	uniform float reflectivity;
	#if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( PHONG ) || defined( LAMBERT )
		#define ENV_WORLDPOS
	#endif
	#ifdef ENV_WORLDPOS
		varying vec3 vWorldPosition;
		uniform float refractionRatio;
	#else
		varying vec3 vReflect;
	#endif
#endif`,np=`#ifdef USE_ENVMAP
	#if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( PHONG ) || defined( LAMBERT )
		#define ENV_WORLDPOS
	#endif
	#ifdef ENV_WORLDPOS
		
		varying vec3 vWorldPosition;
	#else
		varying vec3 vReflect;
		uniform float refractionRatio;
	#endif
#endif`,ip=`#ifdef USE_ENVMAP
	#ifdef ENV_WORLDPOS
		vWorldPosition = worldPosition.xyz;
	#else
		vec3 cameraToVertex;
		if ( isOrthographic ) {
			cameraToVertex = normalize( vec3( - viewMatrix[ 0 ][ 2 ], - viewMatrix[ 1 ][ 2 ], - viewMatrix[ 2 ][ 2 ] ) );
		} else {
			cameraToVertex = normalize( worldPosition.xyz - cameraPosition );
		}
		vec3 worldNormal = inverseTransformDirection( transformedNormal, viewMatrix );
		#ifdef ENVMAP_MODE_REFLECTION
			vReflect = reflect( cameraToVertex, worldNormal );
		#else
			vReflect = refract( cameraToVertex, worldNormal, refractionRatio );
		#endif
	#endif
#endif`,sp=`#ifdef USE_FOG
	vFogDepth = - mvPosition.z;
#endif`,rp=`#ifdef USE_FOG
	varying float vFogDepth;
#endif`,op=`#ifdef USE_FOG
	#ifdef FOG_EXP2
		float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
	#else
		float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
	#endif
	gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );
#endif`,ap=`#ifdef USE_FOG
	uniform vec3 fogColor;
	varying float vFogDepth;
	#ifdef FOG_EXP2
		uniform float fogDensity;
	#else
		uniform float fogNear;
		uniform float fogFar;
	#endif
#endif`,cp=`#ifdef USE_GRADIENTMAP
	uniform sampler2D gradientMap;
#endif
vec3 getGradientIrradiance( vec3 normal, vec3 lightDirection ) {
	float dotNL = dot( normal, lightDirection );
	vec2 coord = vec2( dotNL * 0.5 + 0.5, 0.0 );
	#ifdef USE_GRADIENTMAP
		return vec3( texture2D( gradientMap, coord ).r );
	#else
		vec2 fw = fwidth( coord ) * 0.5;
		return mix( vec3( 0.7 ), vec3( 1.0 ), smoothstep( 0.7 - fw.x, 0.7 + fw.x, coord.x ) );
	#endif
}`,lp=`#ifdef USE_LIGHTMAP
	uniform sampler2D lightMap;
	uniform float lightMapIntensity;
#endif`,hp=`LambertMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.specularStrength = specularStrength;`,up=`varying vec3 vViewPosition;
struct LambertMaterial {
	vec3 diffuseColor;
	float specularStrength;
};
void RE_Direct_Lambert( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in LambertMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectDiffuse_Lambert( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in LambertMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_Lambert
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Lambert`,dp=`uniform bool receiveShadow;
uniform vec3 ambientLightColor;
#if defined( USE_LIGHT_PROBES )
	uniform vec3 lightProbe[ 9 ];
#endif
vec3 shGetIrradianceAt( in vec3 normal, in vec3 shCoefficients[ 9 ] ) {
	float x = normal.x, y = normal.y, z = normal.z;
	vec3 result = shCoefficients[ 0 ] * 0.886227;
	result += shCoefficients[ 1 ] * 2.0 * 0.511664 * y;
	result += shCoefficients[ 2 ] * 2.0 * 0.511664 * z;
	result += shCoefficients[ 3 ] * 2.0 * 0.511664 * x;
	result += shCoefficients[ 4 ] * 2.0 * 0.429043 * x * y;
	result += shCoefficients[ 5 ] * 2.0 * 0.429043 * y * z;
	result += shCoefficients[ 6 ] * ( 0.743125 * z * z - 0.247708 );
	result += shCoefficients[ 7 ] * 2.0 * 0.429043 * x * z;
	result += shCoefficients[ 8 ] * 0.429043 * ( x * x - y * y );
	return result;
}
vec3 getLightProbeIrradiance( const in vec3 lightProbe[ 9 ], const in vec3 normal ) {
	vec3 worldNormal = inverseTransformDirection( normal, viewMatrix );
	vec3 irradiance = shGetIrradianceAt( worldNormal, lightProbe );
	return irradiance;
}
vec3 getAmbientLightIrradiance( const in vec3 ambientLightColor ) {
	vec3 irradiance = ambientLightColor;
	return irradiance;
}
float getDistanceAttenuation( const in float lightDistance, const in float cutoffDistance, const in float decayExponent ) {
	float distanceFalloff = 1.0 / max( pow( lightDistance, decayExponent ), 0.01 );
	if ( cutoffDistance > 0.0 ) {
		distanceFalloff *= pow2( saturate( 1.0 - pow4( lightDistance / cutoffDistance ) ) );
	}
	return distanceFalloff;
}
float getSpotAttenuation( const in float coneCosine, const in float penumbraCosine, const in float angleCosine ) {
	return smoothstep( coneCosine, penumbraCosine, angleCosine );
}
#if NUM_DIR_LIGHTS > 0
	struct DirectionalLight {
		vec3 direction;
		vec3 color;
	};
	uniform DirectionalLight directionalLights[ NUM_DIR_LIGHTS ];
	void getDirectionalLightInfo( const in DirectionalLight directionalLight, out IncidentLight light ) {
		light.color = directionalLight.color;
		light.direction = directionalLight.direction;
		light.visible = true;
	}
#endif
#if NUM_POINT_LIGHTS > 0
	struct PointLight {
		vec3 position;
		vec3 color;
		float distance;
		float decay;
	};
	uniform PointLight pointLights[ NUM_POINT_LIGHTS ];
	void getPointLightInfo( const in PointLight pointLight, const in vec3 geometryPosition, out IncidentLight light ) {
		vec3 lVector = pointLight.position - geometryPosition;
		light.direction = normalize( lVector );
		float lightDistance = length( lVector );
		light.color = pointLight.color;
		light.color *= getDistanceAttenuation( lightDistance, pointLight.distance, pointLight.decay );
		light.visible = ( light.color != vec3( 0.0 ) );
	}
#endif
#if NUM_SPOT_LIGHTS > 0
	struct SpotLight {
		vec3 position;
		vec3 direction;
		vec3 color;
		float distance;
		float decay;
		float coneCos;
		float penumbraCos;
	};
	uniform SpotLight spotLights[ NUM_SPOT_LIGHTS ];
	void getSpotLightInfo( const in SpotLight spotLight, const in vec3 geometryPosition, out IncidentLight light ) {
		vec3 lVector = spotLight.position - geometryPosition;
		light.direction = normalize( lVector );
		float angleCos = dot( light.direction, spotLight.direction );
		float spotAttenuation = getSpotAttenuation( spotLight.coneCos, spotLight.penumbraCos, angleCos );
		if ( spotAttenuation > 0.0 ) {
			float lightDistance = length( lVector );
			light.color = spotLight.color * spotAttenuation;
			light.color *= getDistanceAttenuation( lightDistance, spotLight.distance, spotLight.decay );
			light.visible = ( light.color != vec3( 0.0 ) );
		} else {
			light.color = vec3( 0.0 );
			light.visible = false;
		}
	}
#endif
#if NUM_RECT_AREA_LIGHTS > 0
	struct RectAreaLight {
		vec3 color;
		vec3 position;
		vec3 halfWidth;
		vec3 halfHeight;
	};
	uniform sampler2D ltc_1;	uniform sampler2D ltc_2;
	uniform RectAreaLight rectAreaLights[ NUM_RECT_AREA_LIGHTS ];
#endif
#if NUM_HEMI_LIGHTS > 0
	struct HemisphereLight {
		vec3 direction;
		vec3 skyColor;
		vec3 groundColor;
	};
	uniform HemisphereLight hemisphereLights[ NUM_HEMI_LIGHTS ];
	vec3 getHemisphereLightIrradiance( const in HemisphereLight hemiLight, const in vec3 normal ) {
		float dotNL = dot( normal, hemiLight.direction );
		float hemiDiffuseWeight = 0.5 * dotNL + 0.5;
		vec3 irradiance = mix( hemiLight.groundColor, hemiLight.skyColor, hemiDiffuseWeight );
		return irradiance;
	}
#endif`,fp=`#ifdef USE_ENVMAP
	vec3 getIBLIrradiance( const in vec3 normal ) {
		#ifdef ENVMAP_TYPE_CUBE_UV
			vec3 worldNormal = inverseTransformDirection( normal, viewMatrix );
			vec4 envMapColor = textureCubeUV( envMap, envMapRotation * worldNormal, 1.0 );
			return PI * envMapColor.rgb * envMapIntensity;
		#else
			return vec3( 0.0 );
		#endif
	}
	vec3 getIBLRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness ) {
		#ifdef ENVMAP_TYPE_CUBE_UV
			vec3 reflectVec = reflect( - viewDir, normal );
			reflectVec = normalize( mix( reflectVec, normal, roughness * roughness) );
			reflectVec = inverseTransformDirection( reflectVec, viewMatrix );
			vec4 envMapColor = textureCubeUV( envMap, envMapRotation * reflectVec, roughness );
			return envMapColor.rgb * envMapIntensity;
		#else
			return vec3( 0.0 );
		#endif
	}
	#ifdef USE_ANISOTROPY
		vec3 getIBLAnisotropyRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness, const in vec3 bitangent, const in float anisotropy ) {
			#ifdef ENVMAP_TYPE_CUBE_UV
				vec3 bentNormal = cross( bitangent, viewDir );
				bentNormal = normalize( cross( bentNormal, bitangent ) );
				bentNormal = normalize( mix( bentNormal, normal, pow2( pow2( 1.0 - anisotropy * ( 1.0 - roughness ) ) ) ) );
				return getIBLRadiance( viewDir, bentNormal, roughness );
			#else
				return vec3( 0.0 );
			#endif
		}
	#endif
#endif`,pp=`ToonMaterial material;
material.diffuseColor = diffuseColor.rgb;`,mp=`varying vec3 vViewPosition;
struct ToonMaterial {
	vec3 diffuseColor;
};
void RE_Direct_Toon( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in ToonMaterial material, inout ReflectedLight reflectedLight ) {
	vec3 irradiance = getGradientIrradiance( geometryNormal, directLight.direction ) * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectDiffuse_Toon( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in ToonMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_Toon
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Toon`,gp=`BlinnPhongMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.specularColor = specular;
material.specularShininess = shininess;
material.specularStrength = specularStrength;`,vp=`varying vec3 vViewPosition;
struct BlinnPhongMaterial {
	vec3 diffuseColor;
	vec3 specularColor;
	float specularShininess;
	float specularStrength;
};
void RE_Direct_BlinnPhong( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in BlinnPhongMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
	reflectedLight.directSpecular += irradiance * BRDF_BlinnPhong( directLight.direction, geometryViewDir, geometryNormal, material.specularColor, material.specularShininess ) * material.specularStrength;
}
void RE_IndirectDiffuse_BlinnPhong( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in BlinnPhongMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_BlinnPhong
#define RE_IndirectDiffuse		RE_IndirectDiffuse_BlinnPhong`,xp=`PhysicalMaterial material;
material.diffuseColor = diffuseColor.rgb * ( 1.0 - metalnessFactor );
vec3 dxy = max( abs( dFdx( nonPerturbedNormal ) ), abs( dFdy( nonPerturbedNormal ) ) );
float geometryRoughness = max( max( dxy.x, dxy.y ), dxy.z );
material.roughness = max( roughnessFactor, 0.0525 );material.roughness += geometryRoughness;
material.roughness = min( material.roughness, 1.0 );
#ifdef IOR
	material.ior = ior;
	#ifdef USE_SPECULAR
		float specularIntensityFactor = specularIntensity;
		vec3 specularColorFactor = specularColor;
		#ifdef USE_SPECULAR_COLORMAP
			specularColorFactor *= texture2D( specularColorMap, vSpecularColorMapUv ).rgb;
		#endif
		#ifdef USE_SPECULAR_INTENSITYMAP
			specularIntensityFactor *= texture2D( specularIntensityMap, vSpecularIntensityMapUv ).a;
		#endif
		material.specularF90 = mix( specularIntensityFactor, 1.0, metalnessFactor );
	#else
		float specularIntensityFactor = 1.0;
		vec3 specularColorFactor = vec3( 1.0 );
		material.specularF90 = 1.0;
	#endif
	material.specularColor = mix( min( pow2( ( material.ior - 1.0 ) / ( material.ior + 1.0 ) ) * specularColorFactor, vec3( 1.0 ) ) * specularIntensityFactor, diffuseColor.rgb, metalnessFactor );
#else
	material.specularColor = mix( vec3( 0.04 ), diffuseColor.rgb, metalnessFactor );
	material.specularF90 = 1.0;
#endif
#ifdef USE_CLEARCOAT
	material.clearcoat = clearcoat;
	material.clearcoatRoughness = clearcoatRoughness;
	material.clearcoatF0 = vec3( 0.04 );
	material.clearcoatF90 = 1.0;
	#ifdef USE_CLEARCOATMAP
		material.clearcoat *= texture2D( clearcoatMap, vClearcoatMapUv ).x;
	#endif
	#ifdef USE_CLEARCOAT_ROUGHNESSMAP
		material.clearcoatRoughness *= texture2D( clearcoatRoughnessMap, vClearcoatRoughnessMapUv ).y;
	#endif
	material.clearcoat = saturate( material.clearcoat );	material.clearcoatRoughness = max( material.clearcoatRoughness, 0.0525 );
	material.clearcoatRoughness += geometryRoughness;
	material.clearcoatRoughness = min( material.clearcoatRoughness, 1.0 );
#endif
#ifdef USE_DISPERSION
	material.dispersion = dispersion;
#endif
#ifdef USE_IRIDESCENCE
	material.iridescence = iridescence;
	material.iridescenceIOR = iridescenceIOR;
	#ifdef USE_IRIDESCENCEMAP
		material.iridescence *= texture2D( iridescenceMap, vIridescenceMapUv ).r;
	#endif
	#ifdef USE_IRIDESCENCE_THICKNESSMAP
		material.iridescenceThickness = (iridescenceThicknessMaximum - iridescenceThicknessMinimum) * texture2D( iridescenceThicknessMap, vIridescenceThicknessMapUv ).g + iridescenceThicknessMinimum;
	#else
		material.iridescenceThickness = iridescenceThicknessMaximum;
	#endif
#endif
#ifdef USE_SHEEN
	material.sheenColor = sheenColor;
	#ifdef USE_SHEEN_COLORMAP
		material.sheenColor *= texture2D( sheenColorMap, vSheenColorMapUv ).rgb;
	#endif
	material.sheenRoughness = clamp( sheenRoughness, 0.07, 1.0 );
	#ifdef USE_SHEEN_ROUGHNESSMAP
		material.sheenRoughness *= texture2D( sheenRoughnessMap, vSheenRoughnessMapUv ).a;
	#endif
#endif
#ifdef USE_ANISOTROPY
	#ifdef USE_ANISOTROPYMAP
		mat2 anisotropyMat = mat2( anisotropyVector.x, anisotropyVector.y, - anisotropyVector.y, anisotropyVector.x );
		vec3 anisotropyPolar = texture2D( anisotropyMap, vAnisotropyMapUv ).rgb;
		vec2 anisotropyV = anisotropyMat * normalize( 2.0 * anisotropyPolar.rg - vec2( 1.0 ) ) * anisotropyPolar.b;
	#else
		vec2 anisotropyV = anisotropyVector;
	#endif
	material.anisotropy = length( anisotropyV );
	if( material.anisotropy == 0.0 ) {
		anisotropyV = vec2( 1.0, 0.0 );
	} else {
		anisotropyV /= material.anisotropy;
		material.anisotropy = saturate( material.anisotropy );
	}
	material.alphaT = mix( pow2( material.roughness ), 1.0, pow2( material.anisotropy ) );
	material.anisotropyT = tbn[ 0 ] * anisotropyV.x + tbn[ 1 ] * anisotropyV.y;
	material.anisotropyB = tbn[ 1 ] * anisotropyV.x - tbn[ 0 ] * anisotropyV.y;
#endif`,_p=`struct PhysicalMaterial {
	vec3 diffuseColor;
	float roughness;
	vec3 specularColor;
	float specularF90;
	float dispersion;
	#ifdef USE_CLEARCOAT
		float clearcoat;
		float clearcoatRoughness;
		vec3 clearcoatF0;
		float clearcoatF90;
	#endif
	#ifdef USE_IRIDESCENCE
		float iridescence;
		float iridescenceIOR;
		float iridescenceThickness;
		vec3 iridescenceFresnel;
		vec3 iridescenceF0;
	#endif
	#ifdef USE_SHEEN
		vec3 sheenColor;
		float sheenRoughness;
	#endif
	#ifdef IOR
		float ior;
	#endif
	#ifdef USE_TRANSMISSION
		float transmission;
		float transmissionAlpha;
		float thickness;
		float attenuationDistance;
		vec3 attenuationColor;
	#endif
	#ifdef USE_ANISOTROPY
		float anisotropy;
		float alphaT;
		vec3 anisotropyT;
		vec3 anisotropyB;
	#endif
};
vec3 clearcoatSpecularDirect = vec3( 0.0 );
vec3 clearcoatSpecularIndirect = vec3( 0.0 );
vec3 sheenSpecularDirect = vec3( 0.0 );
vec3 sheenSpecularIndirect = vec3(0.0 );
vec3 Schlick_to_F0( const in vec3 f, const in float f90, const in float dotVH ) {
    float x = clamp( 1.0 - dotVH, 0.0, 1.0 );
    float x2 = x * x;
    float x5 = clamp( x * x2 * x2, 0.0, 0.9999 );
    return ( f - vec3( f90 ) * x5 ) / ( 1.0 - x5 );
}
float V_GGX_SmithCorrelated( const in float alpha, const in float dotNL, const in float dotNV ) {
	float a2 = pow2( alpha );
	float gv = dotNL * sqrt( a2 + ( 1.0 - a2 ) * pow2( dotNV ) );
	float gl = dotNV * sqrt( a2 + ( 1.0 - a2 ) * pow2( dotNL ) );
	return 0.5 / max( gv + gl, EPSILON );
}
float D_GGX( const in float alpha, const in float dotNH ) {
	float a2 = pow2( alpha );
	float denom = pow2( dotNH ) * ( a2 - 1.0 ) + 1.0;
	return RECIPROCAL_PI * a2 / pow2( denom );
}
#ifdef USE_ANISOTROPY
	float V_GGX_SmithCorrelated_Anisotropic( const in float alphaT, const in float alphaB, const in float dotTV, const in float dotBV, const in float dotTL, const in float dotBL, const in float dotNV, const in float dotNL ) {
		float gv = dotNL * length( vec3( alphaT * dotTV, alphaB * dotBV, dotNV ) );
		float gl = dotNV * length( vec3( alphaT * dotTL, alphaB * dotBL, dotNL ) );
		float v = 0.5 / ( gv + gl );
		return saturate(v);
	}
	float D_GGX_Anisotropic( const in float alphaT, const in float alphaB, const in float dotNH, const in float dotTH, const in float dotBH ) {
		float a2 = alphaT * alphaB;
		highp vec3 v = vec3( alphaB * dotTH, alphaT * dotBH, a2 * dotNH );
		highp float v2 = dot( v, v );
		float w2 = a2 / v2;
		return RECIPROCAL_PI * a2 * pow2 ( w2 );
	}
#endif
#ifdef USE_CLEARCOAT
	vec3 BRDF_GGX_Clearcoat( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in PhysicalMaterial material) {
		vec3 f0 = material.clearcoatF0;
		float f90 = material.clearcoatF90;
		float roughness = material.clearcoatRoughness;
		float alpha = pow2( roughness );
		vec3 halfDir = normalize( lightDir + viewDir );
		float dotNL = saturate( dot( normal, lightDir ) );
		float dotNV = saturate( dot( normal, viewDir ) );
		float dotNH = saturate( dot( normal, halfDir ) );
		float dotVH = saturate( dot( viewDir, halfDir ) );
		vec3 F = F_Schlick( f0, f90, dotVH );
		float V = V_GGX_SmithCorrelated( alpha, dotNL, dotNV );
		float D = D_GGX( alpha, dotNH );
		return F * ( V * D );
	}
#endif
vec3 BRDF_GGX( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in PhysicalMaterial material ) {
	vec3 f0 = material.specularColor;
	float f90 = material.specularF90;
	float roughness = material.roughness;
	float alpha = pow2( roughness );
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNL = saturate( dot( normal, lightDir ) );
	float dotNV = saturate( dot( normal, viewDir ) );
	float dotNH = saturate( dot( normal, halfDir ) );
	float dotVH = saturate( dot( viewDir, halfDir ) );
	vec3 F = F_Schlick( f0, f90, dotVH );
	#ifdef USE_IRIDESCENCE
		F = mix( F, material.iridescenceFresnel, material.iridescence );
	#endif
	#ifdef USE_ANISOTROPY
		float dotTL = dot( material.anisotropyT, lightDir );
		float dotTV = dot( material.anisotropyT, viewDir );
		float dotTH = dot( material.anisotropyT, halfDir );
		float dotBL = dot( material.anisotropyB, lightDir );
		float dotBV = dot( material.anisotropyB, viewDir );
		float dotBH = dot( material.anisotropyB, halfDir );
		float V = V_GGX_SmithCorrelated_Anisotropic( material.alphaT, alpha, dotTV, dotBV, dotTL, dotBL, dotNV, dotNL );
		float D = D_GGX_Anisotropic( material.alphaT, alpha, dotNH, dotTH, dotBH );
	#else
		float V = V_GGX_SmithCorrelated( alpha, dotNL, dotNV );
		float D = D_GGX( alpha, dotNH );
	#endif
	return F * ( V * D );
}
vec2 LTC_Uv( const in vec3 N, const in vec3 V, const in float roughness ) {
	const float LUT_SIZE = 64.0;
	const float LUT_SCALE = ( LUT_SIZE - 1.0 ) / LUT_SIZE;
	const float LUT_BIAS = 0.5 / LUT_SIZE;
	float dotNV = saturate( dot( N, V ) );
	vec2 uv = vec2( roughness, sqrt( 1.0 - dotNV ) );
	uv = uv * LUT_SCALE + LUT_BIAS;
	return uv;
}
float LTC_ClippedSphereFormFactor( const in vec3 f ) {
	float l = length( f );
	return max( ( l * l + f.z ) / ( l + 1.0 ), 0.0 );
}
vec3 LTC_EdgeVectorFormFactor( const in vec3 v1, const in vec3 v2 ) {
	float x = dot( v1, v2 );
	float y = abs( x );
	float a = 0.8543985 + ( 0.4965155 + 0.0145206 * y ) * y;
	float b = 3.4175940 + ( 4.1616724 + y ) * y;
	float v = a / b;
	float theta_sintheta = ( x > 0.0 ) ? v : 0.5 * inversesqrt( max( 1.0 - x * x, 1e-7 ) ) - v;
	return cross( v1, v2 ) * theta_sintheta;
}
vec3 LTC_Evaluate( const in vec3 N, const in vec3 V, const in vec3 P, const in mat3 mInv, const in vec3 rectCoords[ 4 ] ) {
	vec3 v1 = rectCoords[ 1 ] - rectCoords[ 0 ];
	vec3 v2 = rectCoords[ 3 ] - rectCoords[ 0 ];
	vec3 lightNormal = cross( v1, v2 );
	if( dot( lightNormal, P - rectCoords[ 0 ] ) < 0.0 ) return vec3( 0.0 );
	vec3 T1, T2;
	T1 = normalize( V - N * dot( V, N ) );
	T2 = - cross( N, T1 );
	mat3 mat = mInv * transposeMat3( mat3( T1, T2, N ) );
	vec3 coords[ 4 ];
	coords[ 0 ] = mat * ( rectCoords[ 0 ] - P );
	coords[ 1 ] = mat * ( rectCoords[ 1 ] - P );
	coords[ 2 ] = mat * ( rectCoords[ 2 ] - P );
	coords[ 3 ] = mat * ( rectCoords[ 3 ] - P );
	coords[ 0 ] = normalize( coords[ 0 ] );
	coords[ 1 ] = normalize( coords[ 1 ] );
	coords[ 2 ] = normalize( coords[ 2 ] );
	coords[ 3 ] = normalize( coords[ 3 ] );
	vec3 vectorFormFactor = vec3( 0.0 );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 0 ], coords[ 1 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 1 ], coords[ 2 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 2 ], coords[ 3 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 3 ], coords[ 0 ] );
	float result = LTC_ClippedSphereFormFactor( vectorFormFactor );
	return vec3( result );
}
#if defined( USE_SHEEN )
float D_Charlie( float roughness, float dotNH ) {
	float alpha = pow2( roughness );
	float invAlpha = 1.0 / alpha;
	float cos2h = dotNH * dotNH;
	float sin2h = max( 1.0 - cos2h, 0.0078125 );
	return ( 2.0 + invAlpha ) * pow( sin2h, invAlpha * 0.5 ) / ( 2.0 * PI );
}
float V_Neubelt( float dotNV, float dotNL ) {
	return saturate( 1.0 / ( 4.0 * ( dotNL + dotNV - dotNL * dotNV ) ) );
}
vec3 BRDF_Sheen( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, vec3 sheenColor, const in float sheenRoughness ) {
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNL = saturate( dot( normal, lightDir ) );
	float dotNV = saturate( dot( normal, viewDir ) );
	float dotNH = saturate( dot( normal, halfDir ) );
	float D = D_Charlie( sheenRoughness, dotNH );
	float V = V_Neubelt( dotNV, dotNL );
	return sheenColor * ( D * V );
}
#endif
float IBLSheenBRDF( const in vec3 normal, const in vec3 viewDir, const in float roughness ) {
	float dotNV = saturate( dot( normal, viewDir ) );
	float r2 = roughness * roughness;
	float a = roughness < 0.25 ? -339.2 * r2 + 161.4 * roughness - 25.9 : -8.48 * r2 + 14.3 * roughness - 9.95;
	float b = roughness < 0.25 ? 44.0 * r2 - 23.7 * roughness + 3.26 : 1.97 * r2 - 3.27 * roughness + 0.72;
	float DG = exp( a * dotNV + b ) + ( roughness < 0.25 ? 0.0 : 0.1 * ( roughness - 0.25 ) );
	return saturate( DG * RECIPROCAL_PI );
}
vec2 DFGApprox( const in vec3 normal, const in vec3 viewDir, const in float roughness ) {
	float dotNV = saturate( dot( normal, viewDir ) );
	const vec4 c0 = vec4( - 1, - 0.0275, - 0.572, 0.022 );
	const vec4 c1 = vec4( 1, 0.0425, 1.04, - 0.04 );
	vec4 r = roughness * c0 + c1;
	float a004 = min( r.x * r.x, exp2( - 9.28 * dotNV ) ) * r.x + r.y;
	vec2 fab = vec2( - 1.04, 1.04 ) * a004 + r.zw;
	return fab;
}
vec3 EnvironmentBRDF( const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float roughness ) {
	vec2 fab = DFGApprox( normal, viewDir, roughness );
	return specularColor * fab.x + specularF90 * fab.y;
}
#ifdef USE_IRIDESCENCE
void computeMultiscatteringIridescence( const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float iridescence, const in vec3 iridescenceF0, const in float roughness, inout vec3 singleScatter, inout vec3 multiScatter ) {
#else
void computeMultiscattering( const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float roughness, inout vec3 singleScatter, inout vec3 multiScatter ) {
#endif
	vec2 fab = DFGApprox( normal, viewDir, roughness );
	#ifdef USE_IRIDESCENCE
		vec3 Fr = mix( specularColor, iridescenceF0, iridescence );
	#else
		vec3 Fr = specularColor;
	#endif
	vec3 FssEss = Fr * fab.x + specularF90 * fab.y;
	float Ess = fab.x + fab.y;
	float Ems = 1.0 - Ess;
	vec3 Favg = Fr + ( 1.0 - Fr ) * 0.047619;	vec3 Fms = FssEss * Favg / ( 1.0 - Ems * Favg );
	singleScatter += FssEss;
	multiScatter += Fms * Ems;
}
#if NUM_RECT_AREA_LIGHTS > 0
	void RE_Direct_RectArea_Physical( const in RectAreaLight rectAreaLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
		vec3 normal = geometryNormal;
		vec3 viewDir = geometryViewDir;
		vec3 position = geometryPosition;
		vec3 lightPos = rectAreaLight.position;
		vec3 halfWidth = rectAreaLight.halfWidth;
		vec3 halfHeight = rectAreaLight.halfHeight;
		vec3 lightColor = rectAreaLight.color;
		float roughness = material.roughness;
		vec3 rectCoords[ 4 ];
		rectCoords[ 0 ] = lightPos + halfWidth - halfHeight;		rectCoords[ 1 ] = lightPos - halfWidth - halfHeight;
		rectCoords[ 2 ] = lightPos - halfWidth + halfHeight;
		rectCoords[ 3 ] = lightPos + halfWidth + halfHeight;
		vec2 uv = LTC_Uv( normal, viewDir, roughness );
		vec4 t1 = texture2D( ltc_1, uv );
		vec4 t2 = texture2D( ltc_2, uv );
		mat3 mInv = mat3(
			vec3( t1.x, 0, t1.y ),
			vec3(    0, 1,    0 ),
			vec3( t1.z, 0, t1.w )
		);
		vec3 fresnel = ( material.specularColor * t2.x + ( vec3( 1.0 ) - material.specularColor ) * t2.y );
		reflectedLight.directSpecular += lightColor * fresnel * LTC_Evaluate( normal, viewDir, position, mInv, rectCoords );
		reflectedLight.directDiffuse += lightColor * material.diffuseColor * LTC_Evaluate( normal, viewDir, position, mat3( 1.0 ), rectCoords );
	}
#endif
void RE_Direct_Physical( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	#ifdef USE_CLEARCOAT
		float dotNLcc = saturate( dot( geometryClearcoatNormal, directLight.direction ) );
		vec3 ccIrradiance = dotNLcc * directLight.color;
		clearcoatSpecularDirect += ccIrradiance * BRDF_GGX_Clearcoat( directLight.direction, geometryViewDir, geometryClearcoatNormal, material );
	#endif
	#ifdef USE_SHEEN
		sheenSpecularDirect += irradiance * BRDF_Sheen( directLight.direction, geometryViewDir, geometryNormal, material.sheenColor, material.sheenRoughness );
	#endif
	reflectedLight.directSpecular += irradiance * BRDF_GGX( directLight.direction, geometryViewDir, geometryNormal, material );
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectDiffuse_Physical( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectSpecular_Physical( const in vec3 radiance, const in vec3 irradiance, const in vec3 clearcoatRadiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight) {
	#ifdef USE_CLEARCOAT
		clearcoatSpecularIndirect += clearcoatRadiance * EnvironmentBRDF( geometryClearcoatNormal, geometryViewDir, material.clearcoatF0, material.clearcoatF90, material.clearcoatRoughness );
	#endif
	#ifdef USE_SHEEN
		sheenSpecularIndirect += irradiance * material.sheenColor * IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness );
	#endif
	vec3 singleScattering = vec3( 0.0 );
	vec3 multiScattering = vec3( 0.0 );
	vec3 cosineWeightedIrradiance = irradiance * RECIPROCAL_PI;
	#ifdef USE_IRIDESCENCE
		computeMultiscatteringIridescence( geometryNormal, geometryViewDir, material.specularColor, material.specularF90, material.iridescence, material.iridescenceFresnel, material.roughness, singleScattering, multiScattering );
	#else
		computeMultiscattering( geometryNormal, geometryViewDir, material.specularColor, material.specularF90, material.roughness, singleScattering, multiScattering );
	#endif
	vec3 totalScattering = singleScattering + multiScattering;
	vec3 diffuse = material.diffuseColor * ( 1.0 - max( max( totalScattering.r, totalScattering.g ), totalScattering.b ) );
	reflectedLight.indirectSpecular += radiance * singleScattering;
	reflectedLight.indirectSpecular += multiScattering * cosineWeightedIrradiance;
	reflectedLight.indirectDiffuse += diffuse * cosineWeightedIrradiance;
}
#define RE_Direct				RE_Direct_Physical
#define RE_Direct_RectArea		RE_Direct_RectArea_Physical
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Physical
#define RE_IndirectSpecular		RE_IndirectSpecular_Physical
float computeSpecularOcclusion( const in float dotNV, const in float ambientOcclusion, const in float roughness ) {
	return saturate( pow( dotNV + ambientOcclusion, exp2( - 16.0 * roughness - 1.0 ) ) - 1.0 + ambientOcclusion );
}`,yp=`
vec3 geometryPosition = - vViewPosition;
vec3 geometryNormal = normal;
vec3 geometryViewDir = ( isOrthographic ) ? vec3( 0, 0, 1 ) : normalize( vViewPosition );
vec3 geometryClearcoatNormal = vec3( 0.0 );
#ifdef USE_CLEARCOAT
	geometryClearcoatNormal = clearcoatNormal;
#endif
#ifdef USE_IRIDESCENCE
	float dotNVi = saturate( dot( normal, geometryViewDir ) );
	if ( material.iridescenceThickness == 0.0 ) {
		material.iridescence = 0.0;
	} else {
		material.iridescence = saturate( material.iridescence );
	}
	if ( material.iridescence > 0.0 ) {
		material.iridescenceFresnel = evalIridescence( 1.0, material.iridescenceIOR, dotNVi, material.iridescenceThickness, material.specularColor );
		material.iridescenceF0 = Schlick_to_F0( material.iridescenceFresnel, 1.0, dotNVi );
	}
#endif
IncidentLight directLight;
#if ( NUM_POINT_LIGHTS > 0 ) && defined( RE_Direct )
	PointLight pointLight;
	#if defined( USE_SHADOWMAP ) && NUM_POINT_LIGHT_SHADOWS > 0
	PointLightShadow pointLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_POINT_LIGHTS; i ++ ) {
		pointLight = pointLights[ i ];
		getPointLightInfo( pointLight, geometryPosition, directLight );
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_POINT_LIGHT_SHADOWS )
		pointLightShadow = pointLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getPointShadow( pointShadowMap[ i ], pointLightShadow.shadowMapSize, pointLightShadow.shadowIntensity, pointLightShadow.shadowBias, pointLightShadow.shadowRadius, vPointShadowCoord[ i ], pointLightShadow.shadowCameraNear, pointLightShadow.shadowCameraFar ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_SPOT_LIGHTS > 0 ) && defined( RE_Direct )
	SpotLight spotLight;
	vec4 spotColor;
	vec3 spotLightCoord;
	bool inSpotLightMap;
	#if defined( USE_SHADOWMAP ) && NUM_SPOT_LIGHT_SHADOWS > 0
	SpotLightShadow spotLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHTS; i ++ ) {
		spotLight = spotLights[ i ];
		getSpotLightInfo( spotLight, geometryPosition, directLight );
		#if ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS )
		#define SPOT_LIGHT_MAP_INDEX UNROLLED_LOOP_INDEX
		#elif ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
		#define SPOT_LIGHT_MAP_INDEX NUM_SPOT_LIGHT_MAPS
		#else
		#define SPOT_LIGHT_MAP_INDEX ( UNROLLED_LOOP_INDEX - NUM_SPOT_LIGHT_SHADOWS + NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS )
		#endif
		#if ( SPOT_LIGHT_MAP_INDEX < NUM_SPOT_LIGHT_MAPS )
			spotLightCoord = vSpotLightCoord[ i ].xyz / vSpotLightCoord[ i ].w;
			inSpotLightMap = all( lessThan( abs( spotLightCoord * 2. - 1. ), vec3( 1.0 ) ) );
			spotColor = texture2D( spotLightMap[ SPOT_LIGHT_MAP_INDEX ], spotLightCoord.xy );
			directLight.color = inSpotLightMap ? directLight.color * spotColor.rgb : directLight.color;
		#endif
		#undef SPOT_LIGHT_MAP_INDEX
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
		spotLightShadow = spotLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( spotShadowMap[ i ], spotLightShadow.shadowMapSize, spotLightShadow.shadowIntensity, spotLightShadow.shadowBias, spotLightShadow.shadowRadius, vSpotLightCoord[ i ] ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_DIR_LIGHTS > 0 ) && defined( RE_Direct )
	DirectionalLight directionalLight;
	#if defined( USE_SHADOWMAP ) && NUM_DIR_LIGHT_SHADOWS > 0
	DirectionalLightShadow directionalLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_DIR_LIGHTS; i ++ ) {
		directionalLight = directionalLights[ i ];
		getDirectionalLightInfo( directionalLight, directLight );
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_DIR_LIGHT_SHADOWS )
		directionalLightShadow = directionalLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( directionalShadowMap[ i ], directionalLightShadow.shadowMapSize, directionalLightShadow.shadowIntensity, directionalLightShadow.shadowBias, directionalLightShadow.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_RECT_AREA_LIGHTS > 0 ) && defined( RE_Direct_RectArea )
	RectAreaLight rectAreaLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_RECT_AREA_LIGHTS; i ++ ) {
		rectAreaLight = rectAreaLights[ i ];
		RE_Direct_RectArea( rectAreaLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if defined( RE_IndirectDiffuse )
	vec3 iblIrradiance = vec3( 0.0 );
	vec3 irradiance = getAmbientLightIrradiance( ambientLightColor );
	#if defined( USE_LIGHT_PROBES )
		irradiance += getLightProbeIrradiance( lightProbe, geometryNormal );
	#endif
	#if ( NUM_HEMI_LIGHTS > 0 )
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_HEMI_LIGHTS; i ++ ) {
			irradiance += getHemisphereLightIrradiance( hemisphereLights[ i ], geometryNormal );
		}
		#pragma unroll_loop_end
	#endif
#endif
#if defined( RE_IndirectSpecular )
	vec3 radiance = vec3( 0.0 );
	vec3 clearcoatRadiance = vec3( 0.0 );
#endif`,Mp=`#if defined( RE_IndirectDiffuse )
	#ifdef USE_LIGHTMAP
		vec4 lightMapTexel = texture2D( lightMap, vLightMapUv );
		vec3 lightMapIrradiance = lightMapTexel.rgb * lightMapIntensity;
		irradiance += lightMapIrradiance;
	#endif
	#if defined( USE_ENVMAP ) && defined( STANDARD ) && defined( ENVMAP_TYPE_CUBE_UV )
		iblIrradiance += getIBLIrradiance( geometryNormal );
	#endif
#endif
#if defined( USE_ENVMAP ) && defined( RE_IndirectSpecular )
	#ifdef USE_ANISOTROPY
		radiance += getIBLAnisotropyRadiance( geometryViewDir, geometryNormal, material.roughness, material.anisotropyB, material.anisotropy );
	#else
		radiance += getIBLRadiance( geometryViewDir, geometryNormal, material.roughness );
	#endif
	#ifdef USE_CLEARCOAT
		clearcoatRadiance += getIBLRadiance( geometryViewDir, geometryClearcoatNormal, material.clearcoatRoughness );
	#endif
#endif`,bp=`#if defined( RE_IndirectDiffuse )
	RE_IndirectDiffuse( irradiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
#endif
#if defined( RE_IndirectSpecular )
	RE_IndirectSpecular( radiance, iblIrradiance, clearcoatRadiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
#endif`,Sp=`#if defined( USE_LOGDEPTHBUF )
	gl_FragDepth = vIsPerspective == 0.0 ? gl_FragCoord.z : log2( vFragDepth ) * logDepthBufFC * 0.5;
#endif`,wp=`#if defined( USE_LOGDEPTHBUF )
	uniform float logDepthBufFC;
	varying float vFragDepth;
	varying float vIsPerspective;
#endif`,Tp=`#ifdef USE_LOGDEPTHBUF
	varying float vFragDepth;
	varying float vIsPerspective;
#endif`,Ep=`#ifdef USE_LOGDEPTHBUF
	vFragDepth = 1.0 + gl_Position.w;
	vIsPerspective = float( isPerspectiveMatrix( projectionMatrix ) );
#endif`,Ap=`#ifdef USE_MAP
	vec4 sampledDiffuseColor = texture2D( map, vMapUv );
	#ifdef DECODE_VIDEO_TEXTURE
		sampledDiffuseColor = vec4( mix( pow( sampledDiffuseColor.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), sampledDiffuseColor.rgb * 0.0773993808, vec3( lessThanEqual( sampledDiffuseColor.rgb, vec3( 0.04045 ) ) ) ), sampledDiffuseColor.w );
	
	#endif
	diffuseColor *= sampledDiffuseColor;
#endif`,Rp=`#ifdef USE_MAP
	uniform sampler2D map;
#endif`,Cp=`#if defined( USE_MAP ) || defined( USE_ALPHAMAP )
	#if defined( USE_POINTS_UV )
		vec2 uv = vUv;
	#else
		vec2 uv = ( uvTransform * vec3( gl_PointCoord.x, 1.0 - gl_PointCoord.y, 1 ) ).xy;
	#endif
#endif
#ifdef USE_MAP
	diffuseColor *= texture2D( map, uv );
#endif
#ifdef USE_ALPHAMAP
	diffuseColor.a *= texture2D( alphaMap, uv ).g;
#endif`,Pp=`#if defined( USE_POINTS_UV )
	varying vec2 vUv;
#else
	#if defined( USE_MAP ) || defined( USE_ALPHAMAP )
		uniform mat3 uvTransform;
	#endif
#endif
#ifdef USE_MAP
	uniform sampler2D map;
#endif
#ifdef USE_ALPHAMAP
	uniform sampler2D alphaMap;
#endif`,Lp=`float metalnessFactor = metalness;
#ifdef USE_METALNESSMAP
	vec4 texelMetalness = texture2D( metalnessMap, vMetalnessMapUv );
	metalnessFactor *= texelMetalness.b;
#endif`,kp=`#ifdef USE_METALNESSMAP
	uniform sampler2D metalnessMap;
#endif`,Dp=`#ifdef USE_INSTANCING_MORPH
	float morphTargetInfluences[ MORPHTARGETS_COUNT ];
	float morphTargetBaseInfluence = texelFetch( morphTexture, ivec2( 0, gl_InstanceID ), 0 ).r;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		morphTargetInfluences[i] =  texelFetch( morphTexture, ivec2( i + 1, gl_InstanceID ), 0 ).r;
	}
#endif`,Ip=`#if defined( USE_MORPHCOLORS )
	vColor *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		#if defined( USE_COLOR_ALPHA )
			if ( morphTargetInfluences[ i ] != 0.0 ) vColor += getMorph( gl_VertexID, i, 2 ) * morphTargetInfluences[ i ];
		#elif defined( USE_COLOR )
			if ( morphTargetInfluences[ i ] != 0.0 ) vColor += getMorph( gl_VertexID, i, 2 ).rgb * morphTargetInfluences[ i ];
		#endif
	}
#endif`,Np=`#ifdef USE_MORPHNORMALS
	objectNormal *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		if ( morphTargetInfluences[ i ] != 0.0 ) objectNormal += getMorph( gl_VertexID, i, 1 ).xyz * morphTargetInfluences[ i ];
	}
#endif`,Up=`#ifdef USE_MORPHTARGETS
	#ifndef USE_INSTANCING_MORPH
		uniform float morphTargetBaseInfluence;
		uniform float morphTargetInfluences[ MORPHTARGETS_COUNT ];
	#endif
	uniform sampler2DArray morphTargetsTexture;
	uniform ivec2 morphTargetsTextureSize;
	vec4 getMorph( const in int vertexIndex, const in int morphTargetIndex, const in int offset ) {
		int texelIndex = vertexIndex * MORPHTARGETS_TEXTURE_STRIDE + offset;
		int y = texelIndex / morphTargetsTextureSize.x;
		int x = texelIndex - y * morphTargetsTextureSize.x;
		ivec3 morphUV = ivec3( x, y, morphTargetIndex );
		return texelFetch( morphTargetsTexture, morphUV, 0 );
	}
#endif`,zp=`#ifdef USE_MORPHTARGETS
	transformed *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		if ( morphTargetInfluences[ i ] != 0.0 ) transformed += getMorph( gl_VertexID, i, 0 ).xyz * morphTargetInfluences[ i ];
	}
#endif`,Fp=`float faceDirection = gl_FrontFacing ? 1.0 : - 1.0;
#ifdef FLAT_SHADED
	vec3 fdx = dFdx( vViewPosition );
	vec3 fdy = dFdy( vViewPosition );
	vec3 normal = normalize( cross( fdx, fdy ) );
#else
	vec3 normal = normalize( vNormal );
	#ifdef DOUBLE_SIDED
		normal *= faceDirection;
	#endif
#endif
#if defined( USE_NORMALMAP_TANGENTSPACE ) || defined( USE_CLEARCOAT_NORMALMAP ) || defined( USE_ANISOTROPY )
	#ifdef USE_TANGENT
		mat3 tbn = mat3( normalize( vTangent ), normalize( vBitangent ), normal );
	#else
		mat3 tbn = getTangentFrame( - vViewPosition, normal,
		#if defined( USE_NORMALMAP )
			vNormalMapUv
		#elif defined( USE_CLEARCOAT_NORMALMAP )
			vClearcoatNormalMapUv
		#else
			vUv
		#endif
		);
	#endif
	#if defined( DOUBLE_SIDED ) && ! defined( FLAT_SHADED )
		tbn[0] *= faceDirection;
		tbn[1] *= faceDirection;
	#endif
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	#ifdef USE_TANGENT
		mat3 tbn2 = mat3( normalize( vTangent ), normalize( vBitangent ), normal );
	#else
		mat3 tbn2 = getTangentFrame( - vViewPosition, normal, vClearcoatNormalMapUv );
	#endif
	#if defined( DOUBLE_SIDED ) && ! defined( FLAT_SHADED )
		tbn2[0] *= faceDirection;
		tbn2[1] *= faceDirection;
	#endif
#endif
vec3 nonPerturbedNormal = normal;`,Bp=`#ifdef USE_NORMALMAP_OBJECTSPACE
	normal = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;
	#ifdef FLIP_SIDED
		normal = - normal;
	#endif
	#ifdef DOUBLE_SIDED
		normal = normal * faceDirection;
	#endif
	normal = normalize( normalMatrix * normal );
#elif defined( USE_NORMALMAP_TANGENTSPACE )
	vec3 mapN = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;
	mapN.xy *= normalScale;
	normal = normalize( tbn * mapN );
#elif defined( USE_BUMPMAP )
	normal = perturbNormalArb( - vViewPosition, normal, dHdxy_fwd(), faceDirection );
#endif`,Op=`#ifndef FLAT_SHADED
	varying vec3 vNormal;
	#ifdef USE_TANGENT
		varying vec3 vTangent;
		varying vec3 vBitangent;
	#endif
#endif`,Hp=`#ifndef FLAT_SHADED
	varying vec3 vNormal;
	#ifdef USE_TANGENT
		varying vec3 vTangent;
		varying vec3 vBitangent;
	#endif
#endif`,Vp=`#ifndef FLAT_SHADED
	vNormal = normalize( transformedNormal );
	#ifdef USE_TANGENT
		vTangent = normalize( transformedTangent );
		vBitangent = normalize( cross( vNormal, vTangent ) * tangent.w );
	#endif
#endif`,Gp=`#ifdef USE_NORMALMAP
	uniform sampler2D normalMap;
	uniform vec2 normalScale;
#endif
#ifdef USE_NORMALMAP_OBJECTSPACE
	uniform mat3 normalMatrix;
#endif
#if ! defined ( USE_TANGENT ) && ( defined ( USE_NORMALMAP_TANGENTSPACE ) || defined ( USE_CLEARCOAT_NORMALMAP ) || defined( USE_ANISOTROPY ) )
	mat3 getTangentFrame( vec3 eye_pos, vec3 surf_norm, vec2 uv ) {
		vec3 q0 = dFdx( eye_pos.xyz );
		vec3 q1 = dFdy( eye_pos.xyz );
		vec2 st0 = dFdx( uv.st );
		vec2 st1 = dFdy( uv.st );
		vec3 N = surf_norm;
		vec3 q1perp = cross( q1, N );
		vec3 q0perp = cross( N, q0 );
		vec3 T = q1perp * st0.x + q0perp * st1.x;
		vec3 B = q1perp * st0.y + q0perp * st1.y;
		float det = max( dot( T, T ), dot( B, B ) );
		float scale = ( det == 0.0 ) ? 0.0 : inversesqrt( det );
		return mat3( T * scale, B * scale, N );
	}
#endif`,Wp=`#ifdef USE_CLEARCOAT
	vec3 clearcoatNormal = nonPerturbedNormal;
#endif`,qp=`#ifdef USE_CLEARCOAT_NORMALMAP
	vec3 clearcoatMapN = texture2D( clearcoatNormalMap, vClearcoatNormalMapUv ).xyz * 2.0 - 1.0;
	clearcoatMapN.xy *= clearcoatNormalScale;
	clearcoatNormal = normalize( tbn2 * clearcoatMapN );
#endif`,Xp=`#ifdef USE_CLEARCOATMAP
	uniform sampler2D clearcoatMap;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	uniform sampler2D clearcoatNormalMap;
	uniform vec2 clearcoatNormalScale;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	uniform sampler2D clearcoatRoughnessMap;
#endif`,jp=`#ifdef USE_IRIDESCENCEMAP
	uniform sampler2D iridescenceMap;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	uniform sampler2D iridescenceThicknessMap;
#endif`,Yp=`#ifdef OPAQUE
diffuseColor.a = 1.0;
#endif
#ifdef USE_TRANSMISSION
diffuseColor.a *= material.transmissionAlpha;
#endif
gl_FragColor = vec4( outgoingLight, diffuseColor.a );`,$p=`vec3 packNormalToRGB( const in vec3 normal ) {
	return normalize( normal ) * 0.5 + 0.5;
}
vec3 unpackRGBToNormal( const in vec3 rgb ) {
	return 2.0 * rgb.xyz - 1.0;
}
const float PackUpscale = 256. / 255.;const float UnpackDownscale = 255. / 256.;const float ShiftRight8 = 1. / 256.;
const float Inv255 = 1. / 255.;
const vec4 PackFactors = vec4( 1.0, 256.0, 256.0 * 256.0, 256.0 * 256.0 * 256.0 );
const vec2 UnpackFactors2 = vec2( UnpackDownscale, 1.0 / PackFactors.g );
const vec3 UnpackFactors3 = vec3( UnpackDownscale / PackFactors.rg, 1.0 / PackFactors.b );
const vec4 UnpackFactors4 = vec4( UnpackDownscale / PackFactors.rgb, 1.0 / PackFactors.a );
vec4 packDepthToRGBA( const in float v ) {
	if( v <= 0.0 )
		return vec4( 0., 0., 0., 0. );
	if( v >= 1.0 )
		return vec4( 1., 1., 1., 1. );
	float vuf;
	float af = modf( v * PackFactors.a, vuf );
	float bf = modf( vuf * ShiftRight8, vuf );
	float gf = modf( vuf * ShiftRight8, vuf );
	return vec4( vuf * Inv255, gf * PackUpscale, bf * PackUpscale, af );
}
vec3 packDepthToRGB( const in float v ) {
	if( v <= 0.0 )
		return vec3( 0., 0., 0. );
	if( v >= 1.0 )
		return vec3( 1., 1., 1. );
	float vuf;
	float bf = modf( v * PackFactors.b, vuf );
	float gf = modf( vuf * ShiftRight8, vuf );
	return vec3( vuf * Inv255, gf * PackUpscale, bf );
}
vec2 packDepthToRG( const in float v ) {
	if( v <= 0.0 )
		return vec2( 0., 0. );
	if( v >= 1.0 )
		return vec2( 1., 1. );
	float vuf;
	float gf = modf( v * 256., vuf );
	return vec2( vuf * Inv255, gf );
}
float unpackRGBAToDepth( const in vec4 v ) {
	return dot( v, UnpackFactors4 );
}
float unpackRGBToDepth( const in vec3 v ) {
	return dot( v, UnpackFactors3 );
}
float unpackRGToDepth( const in vec2 v ) {
	return v.r * UnpackFactors2.r + v.g * UnpackFactors2.g;
}
vec4 pack2HalfToRGBA( const in vec2 v ) {
	vec4 r = vec4( v.x, fract( v.x * 255.0 ), v.y, fract( v.y * 255.0 ) );
	return vec4( r.x - r.y / 255.0, r.y, r.z - r.w / 255.0, r.w );
}
vec2 unpackRGBATo2Half( const in vec4 v ) {
	return vec2( v.x + ( v.y / 255.0 ), v.z + ( v.w / 255.0 ) );
}
float viewZToOrthographicDepth( const in float viewZ, const in float near, const in float far ) {
	return ( viewZ + near ) / ( near - far );
}
float orthographicDepthToViewZ( const in float depth, const in float near, const in float far ) {
	return depth * ( near - far ) - near;
}
float viewZToPerspectiveDepth( const in float viewZ, const in float near, const in float far ) {
	return ( ( near + viewZ ) * far ) / ( ( far - near ) * viewZ );
}
float perspectiveDepthToViewZ( const in float depth, const in float near, const in float far ) {
	return ( near * far ) / ( ( far - near ) * depth - far );
}`,Kp=`#ifdef PREMULTIPLIED_ALPHA
	gl_FragColor.rgb *= gl_FragColor.a;
#endif`,Zp=`vec4 mvPosition = vec4( transformed, 1.0 );
#ifdef USE_BATCHING
	mvPosition = batchingMatrix * mvPosition;
#endif
#ifdef USE_INSTANCING
	mvPosition = instanceMatrix * mvPosition;
#endif
mvPosition = modelViewMatrix * mvPosition;
gl_Position = projectionMatrix * mvPosition;`,Jp=`#ifdef DITHERING
	gl_FragColor.rgb = dithering( gl_FragColor.rgb );
#endif`,Qp=`#ifdef DITHERING
	vec3 dithering( vec3 color ) {
		float grid_position = rand( gl_FragCoord.xy );
		vec3 dither_shift_RGB = vec3( 0.25 / 255.0, -0.25 / 255.0, 0.25 / 255.0 );
		dither_shift_RGB = mix( 2.0 * dither_shift_RGB, -2.0 * dither_shift_RGB, grid_position );
		return color + dither_shift_RGB;
	}
#endif`,tm=`float roughnessFactor = roughness;
#ifdef USE_ROUGHNESSMAP
	vec4 texelRoughness = texture2D( roughnessMap, vRoughnessMapUv );
	roughnessFactor *= texelRoughness.g;
#endif`,em=`#ifdef USE_ROUGHNESSMAP
	uniform sampler2D roughnessMap;
#endif`,nm=`#if NUM_SPOT_LIGHT_COORDS > 0
	varying vec4 vSpotLightCoord[ NUM_SPOT_LIGHT_COORDS ];
#endif
#if NUM_SPOT_LIGHT_MAPS > 0
	uniform sampler2D spotLightMap[ NUM_SPOT_LIGHT_MAPS ];
#endif
#ifdef USE_SHADOWMAP
	#if NUM_DIR_LIGHT_SHADOWS > 0
		uniform sampler2D directionalShadowMap[ NUM_DIR_LIGHT_SHADOWS ];
		varying vec4 vDirectionalShadowCoord[ NUM_DIR_LIGHT_SHADOWS ];
		struct DirectionalLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform DirectionalLightShadow directionalLightShadows[ NUM_DIR_LIGHT_SHADOWS ];
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
		uniform sampler2D spotShadowMap[ NUM_SPOT_LIGHT_SHADOWS ];
		struct SpotLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform SpotLightShadow spotLightShadows[ NUM_SPOT_LIGHT_SHADOWS ];
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		uniform sampler2D pointShadowMap[ NUM_POINT_LIGHT_SHADOWS ];
		varying vec4 vPointShadowCoord[ NUM_POINT_LIGHT_SHADOWS ];
		struct PointLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
			float shadowCameraNear;
			float shadowCameraFar;
		};
		uniform PointLightShadow pointLightShadows[ NUM_POINT_LIGHT_SHADOWS ];
	#endif
	float texture2DCompare( sampler2D depths, vec2 uv, float compare ) {
		return step( compare, unpackRGBAToDepth( texture2D( depths, uv ) ) );
	}
	vec2 texture2DDistribution( sampler2D shadow, vec2 uv ) {
		return unpackRGBATo2Half( texture2D( shadow, uv ) );
	}
	float VSMShadow (sampler2D shadow, vec2 uv, float compare ){
		float occlusion = 1.0;
		vec2 distribution = texture2DDistribution( shadow, uv );
		float hard_shadow = step( compare , distribution.x );
		if (hard_shadow != 1.0 ) {
			float distance = compare - distribution.x ;
			float variance = max( 0.00000, distribution.y * distribution.y );
			float softness_probability = variance / (variance + distance * distance );			softness_probability = clamp( ( softness_probability - 0.3 ) / ( 0.95 - 0.3 ), 0.0, 1.0 );			occlusion = clamp( max( hard_shadow, softness_probability ), 0.0, 1.0 );
		}
		return occlusion;
	}
	float getShadow( sampler2D shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord ) {
		float shadow = 1.0;
		shadowCoord.xyz /= shadowCoord.w;
		shadowCoord.z += shadowBias;
		bool inFrustum = shadowCoord.x >= 0.0 && shadowCoord.x <= 1.0 && shadowCoord.y >= 0.0 && shadowCoord.y <= 1.0;
		bool frustumTest = inFrustum && shadowCoord.z <= 1.0;
		if ( frustumTest ) {
		#if defined( SHADOWMAP_TYPE_PCF )
			vec2 texelSize = vec2( 1.0 ) / shadowMapSize;
			float dx0 = - texelSize.x * shadowRadius;
			float dy0 = - texelSize.y * shadowRadius;
			float dx1 = + texelSize.x * shadowRadius;
			float dy1 = + texelSize.y * shadowRadius;
			float dx2 = dx0 / 2.0;
			float dy2 = dy0 / 2.0;
			float dx3 = dx1 / 2.0;
			float dy3 = dy1 / 2.0;
			shadow = (
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx0, dy0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( 0.0, dy0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx1, dy0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx2, dy2 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( 0.0, dy2 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx3, dy2 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx0, 0.0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx2, 0.0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy, shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx3, 0.0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx1, 0.0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx2, dy3 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( 0.0, dy3 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx3, dy3 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx0, dy1 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( 0.0, dy1 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx1, dy1 ), shadowCoord.z )
			) * ( 1.0 / 17.0 );
		#elif defined( SHADOWMAP_TYPE_PCF_SOFT )
			vec2 texelSize = vec2( 1.0 ) / shadowMapSize;
			float dx = texelSize.x;
			float dy = texelSize.y;
			vec2 uv = shadowCoord.xy;
			vec2 f = fract( uv * shadowMapSize + 0.5 );
			uv -= f * texelSize;
			shadow = (
				texture2DCompare( shadowMap, uv, shadowCoord.z ) +
				texture2DCompare( shadowMap, uv + vec2( dx, 0.0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, uv + vec2( 0.0, dy ), shadowCoord.z ) +
				texture2DCompare( shadowMap, uv + texelSize, shadowCoord.z ) +
				mix( texture2DCompare( shadowMap, uv + vec2( -dx, 0.0 ), shadowCoord.z ),
					 texture2DCompare( shadowMap, uv + vec2( 2.0 * dx, 0.0 ), shadowCoord.z ),
					 f.x ) +
				mix( texture2DCompare( shadowMap, uv + vec2( -dx, dy ), shadowCoord.z ),
					 texture2DCompare( shadowMap, uv + vec2( 2.0 * dx, dy ), shadowCoord.z ),
					 f.x ) +
				mix( texture2DCompare( shadowMap, uv + vec2( 0.0, -dy ), shadowCoord.z ),
					 texture2DCompare( shadowMap, uv + vec2( 0.0, 2.0 * dy ), shadowCoord.z ),
					 f.y ) +
				mix( texture2DCompare( shadowMap, uv + vec2( dx, -dy ), shadowCoord.z ),
					 texture2DCompare( shadowMap, uv + vec2( dx, 2.0 * dy ), shadowCoord.z ),
					 f.y ) +
				mix( mix( texture2DCompare( shadowMap, uv + vec2( -dx, -dy ), shadowCoord.z ),
						  texture2DCompare( shadowMap, uv + vec2( 2.0 * dx, -dy ), shadowCoord.z ),
						  f.x ),
					 mix( texture2DCompare( shadowMap, uv + vec2( -dx, 2.0 * dy ), shadowCoord.z ),
						  texture2DCompare( shadowMap, uv + vec2( 2.0 * dx, 2.0 * dy ), shadowCoord.z ),
						  f.x ),
					 f.y )
			) * ( 1.0 / 9.0 );
		#elif defined( SHADOWMAP_TYPE_VSM )
			shadow = VSMShadow( shadowMap, shadowCoord.xy, shadowCoord.z );
		#else
			shadow = texture2DCompare( shadowMap, shadowCoord.xy, shadowCoord.z );
		#endif
		}
		return mix( 1.0, shadow, shadowIntensity );
	}
	vec2 cubeToUV( vec3 v, float texelSizeY ) {
		vec3 absV = abs( v );
		float scaleToCube = 1.0 / max( absV.x, max( absV.y, absV.z ) );
		absV *= scaleToCube;
		v *= scaleToCube * ( 1.0 - 2.0 * texelSizeY );
		vec2 planar = v.xy;
		float almostATexel = 1.5 * texelSizeY;
		float almostOne = 1.0 - almostATexel;
		if ( absV.z >= almostOne ) {
			if ( v.z > 0.0 )
				planar.x = 4.0 - v.x;
		} else if ( absV.x >= almostOne ) {
			float signX = sign( v.x );
			planar.x = v.z * signX + 2.0 * signX;
		} else if ( absV.y >= almostOne ) {
			float signY = sign( v.y );
			planar.x = v.x + 2.0 * signY + 2.0;
			planar.y = v.z * signY - 2.0;
		}
		return vec2( 0.125, 0.25 ) * planar + vec2( 0.375, 0.75 );
	}
	float getPointShadow( sampler2D shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord, float shadowCameraNear, float shadowCameraFar ) {
		float shadow = 1.0;
		vec3 lightToPosition = shadowCoord.xyz;
		
		float lightToPositionLength = length( lightToPosition );
		if ( lightToPositionLength - shadowCameraFar <= 0.0 && lightToPositionLength - shadowCameraNear >= 0.0 ) {
			float dp = ( lightToPositionLength - shadowCameraNear ) / ( shadowCameraFar - shadowCameraNear );			dp += shadowBias;
			vec3 bd3D = normalize( lightToPosition );
			vec2 texelSize = vec2( 1.0 ) / ( shadowMapSize * vec2( 4.0, 2.0 ) );
			#if defined( SHADOWMAP_TYPE_PCF ) || defined( SHADOWMAP_TYPE_PCF_SOFT ) || defined( SHADOWMAP_TYPE_VSM )
				vec2 offset = vec2( - 1, 1 ) * shadowRadius * texelSize.y;
				shadow = (
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.xyy, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.yyy, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.xyx, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.yyx, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.xxy, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.yxy, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.xxx, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.yxx, texelSize.y ), dp )
				) * ( 1.0 / 9.0 );
			#else
				shadow = texture2DCompare( shadowMap, cubeToUV( bd3D, texelSize.y ), dp );
			#endif
		}
		return mix( 1.0, shadow, shadowIntensity );
	}
#endif`,im=`#if NUM_SPOT_LIGHT_COORDS > 0
	uniform mat4 spotLightMatrix[ NUM_SPOT_LIGHT_COORDS ];
	varying vec4 vSpotLightCoord[ NUM_SPOT_LIGHT_COORDS ];
#endif
#ifdef USE_SHADOWMAP
	#if NUM_DIR_LIGHT_SHADOWS > 0
		uniform mat4 directionalShadowMatrix[ NUM_DIR_LIGHT_SHADOWS ];
		varying vec4 vDirectionalShadowCoord[ NUM_DIR_LIGHT_SHADOWS ];
		struct DirectionalLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform DirectionalLightShadow directionalLightShadows[ NUM_DIR_LIGHT_SHADOWS ];
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
		struct SpotLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform SpotLightShadow spotLightShadows[ NUM_SPOT_LIGHT_SHADOWS ];
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		uniform mat4 pointShadowMatrix[ NUM_POINT_LIGHT_SHADOWS ];
		varying vec4 vPointShadowCoord[ NUM_POINT_LIGHT_SHADOWS ];
		struct PointLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
			float shadowCameraNear;
			float shadowCameraFar;
		};
		uniform PointLightShadow pointLightShadows[ NUM_POINT_LIGHT_SHADOWS ];
	#endif
#endif`,sm=`#if ( defined( USE_SHADOWMAP ) && ( NUM_DIR_LIGHT_SHADOWS > 0 || NUM_POINT_LIGHT_SHADOWS > 0 ) ) || ( NUM_SPOT_LIGHT_COORDS > 0 )
	vec3 shadowWorldNormal = inverseTransformDirection( transformedNormal, viewMatrix );
	vec4 shadowWorldPosition;
#endif
#if defined( USE_SHADOWMAP )
	#if NUM_DIR_LIGHT_SHADOWS > 0
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_DIR_LIGHT_SHADOWS; i ++ ) {
			shadowWorldPosition = worldPosition + vec4( shadowWorldNormal * directionalLightShadows[ i ].shadowNormalBias, 0 );
			vDirectionalShadowCoord[ i ] = directionalShadowMatrix[ i ] * shadowWorldPosition;
		}
		#pragma unroll_loop_end
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_POINT_LIGHT_SHADOWS; i ++ ) {
			shadowWorldPosition = worldPosition + vec4( shadowWorldNormal * pointLightShadows[ i ].shadowNormalBias, 0 );
			vPointShadowCoord[ i ] = pointShadowMatrix[ i ] * shadowWorldPosition;
		}
		#pragma unroll_loop_end
	#endif
#endif
#if NUM_SPOT_LIGHT_COORDS > 0
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHT_COORDS; i ++ ) {
		shadowWorldPosition = worldPosition;
		#if ( defined( USE_SHADOWMAP ) && UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
			shadowWorldPosition.xyz += shadowWorldNormal * spotLightShadows[ i ].shadowNormalBias;
		#endif
		vSpotLightCoord[ i ] = spotLightMatrix[ i ] * shadowWorldPosition;
	}
	#pragma unroll_loop_end
#endif`,rm=`float getShadowMask() {
	float shadow = 1.0;
	#ifdef USE_SHADOWMAP
	#if NUM_DIR_LIGHT_SHADOWS > 0
	DirectionalLightShadow directionalLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_DIR_LIGHT_SHADOWS; i ++ ) {
		directionalLight = directionalLightShadows[ i ];
		shadow *= receiveShadow ? getShadow( directionalShadowMap[ i ], directionalLight.shadowMapSize, directionalLight.shadowIntensity, directionalLight.shadowBias, directionalLight.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
	SpotLightShadow spotLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHT_SHADOWS; i ++ ) {
		spotLight = spotLightShadows[ i ];
		shadow *= receiveShadow ? getShadow( spotShadowMap[ i ], spotLight.shadowMapSize, spotLight.shadowIntensity, spotLight.shadowBias, spotLight.shadowRadius, vSpotLightCoord[ i ] ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
	PointLightShadow pointLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_POINT_LIGHT_SHADOWS; i ++ ) {
		pointLight = pointLightShadows[ i ];
		shadow *= receiveShadow ? getPointShadow( pointShadowMap[ i ], pointLight.shadowMapSize, pointLight.shadowIntensity, pointLight.shadowBias, pointLight.shadowRadius, vPointShadowCoord[ i ], pointLight.shadowCameraNear, pointLight.shadowCameraFar ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#endif
	return shadow;
}`,om=`#ifdef USE_SKINNING
	mat4 boneMatX = getBoneMatrix( skinIndex.x );
	mat4 boneMatY = getBoneMatrix( skinIndex.y );
	mat4 boneMatZ = getBoneMatrix( skinIndex.z );
	mat4 boneMatW = getBoneMatrix( skinIndex.w );
#endif`,am=`#ifdef USE_SKINNING
	uniform mat4 bindMatrix;
	uniform mat4 bindMatrixInverse;
	uniform highp sampler2D boneTexture;
	mat4 getBoneMatrix( const in float i ) {
		int size = textureSize( boneTexture, 0 ).x;
		int j = int( i ) * 4;
		int x = j % size;
		int y = j / size;
		vec4 v1 = texelFetch( boneTexture, ivec2( x, y ), 0 );
		vec4 v2 = texelFetch( boneTexture, ivec2( x + 1, y ), 0 );
		vec4 v3 = texelFetch( boneTexture, ivec2( x + 2, y ), 0 );
		vec4 v4 = texelFetch( boneTexture, ivec2( x + 3, y ), 0 );
		return mat4( v1, v2, v3, v4 );
	}
#endif`,cm=`#ifdef USE_SKINNING
	vec4 skinVertex = bindMatrix * vec4( transformed, 1.0 );
	vec4 skinned = vec4( 0.0 );
	skinned += boneMatX * skinVertex * skinWeight.x;
	skinned += boneMatY * skinVertex * skinWeight.y;
	skinned += boneMatZ * skinVertex * skinWeight.z;
	skinned += boneMatW * skinVertex * skinWeight.w;
	transformed = ( bindMatrixInverse * skinned ).xyz;
#endif`,lm=`#ifdef USE_SKINNING
	mat4 skinMatrix = mat4( 0.0 );
	skinMatrix += skinWeight.x * boneMatX;
	skinMatrix += skinWeight.y * boneMatY;
	skinMatrix += skinWeight.z * boneMatZ;
	skinMatrix += skinWeight.w * boneMatW;
	skinMatrix = bindMatrixInverse * skinMatrix * bindMatrix;
	objectNormal = vec4( skinMatrix * vec4( objectNormal, 0.0 ) ).xyz;
	#ifdef USE_TANGENT
		objectTangent = vec4( skinMatrix * vec4( objectTangent, 0.0 ) ).xyz;
	#endif
#endif`,hm=`float specularStrength;
#ifdef USE_SPECULARMAP
	vec4 texelSpecular = texture2D( specularMap, vSpecularMapUv );
	specularStrength = texelSpecular.r;
#else
	specularStrength = 1.0;
#endif`,um=`#ifdef USE_SPECULARMAP
	uniform sampler2D specularMap;
#endif`,dm=`#if defined( TONE_MAPPING )
	gl_FragColor.rgb = toneMapping( gl_FragColor.rgb );
#endif`,fm=`#ifndef saturate
#define saturate( a ) clamp( a, 0.0, 1.0 )
#endif
uniform float toneMappingExposure;
vec3 LinearToneMapping( vec3 color ) {
	return saturate( toneMappingExposure * color );
}
vec3 ReinhardToneMapping( vec3 color ) {
	color *= toneMappingExposure;
	return saturate( color / ( vec3( 1.0 ) + color ) );
}
vec3 CineonToneMapping( vec3 color ) {
	color *= toneMappingExposure;
	color = max( vec3( 0.0 ), color - 0.004 );
	return pow( ( color * ( 6.2 * color + 0.5 ) ) / ( color * ( 6.2 * color + 1.7 ) + 0.06 ), vec3( 2.2 ) );
}
vec3 RRTAndODTFit( vec3 v ) {
	vec3 a = v * ( v + 0.0245786 ) - 0.000090537;
	vec3 b = v * ( 0.983729 * v + 0.4329510 ) + 0.238081;
	return a / b;
}
vec3 ACESFilmicToneMapping( vec3 color ) {
	const mat3 ACESInputMat = mat3(
		vec3( 0.59719, 0.07600, 0.02840 ),		vec3( 0.35458, 0.90834, 0.13383 ),
		vec3( 0.04823, 0.01566, 0.83777 )
	);
	const mat3 ACESOutputMat = mat3(
		vec3(  1.60475, -0.10208, -0.00327 ),		vec3( -0.53108,  1.10813, -0.07276 ),
		vec3( -0.07367, -0.00605,  1.07602 )
	);
	color *= toneMappingExposure / 0.6;
	color = ACESInputMat * color;
	color = RRTAndODTFit( color );
	color = ACESOutputMat * color;
	return saturate( color );
}
const mat3 LINEAR_REC2020_TO_LINEAR_SRGB = mat3(
	vec3( 1.6605, - 0.1246, - 0.0182 ),
	vec3( - 0.5876, 1.1329, - 0.1006 ),
	vec3( - 0.0728, - 0.0083, 1.1187 )
);
const mat3 LINEAR_SRGB_TO_LINEAR_REC2020 = mat3(
	vec3( 0.6274, 0.0691, 0.0164 ),
	vec3( 0.3293, 0.9195, 0.0880 ),
	vec3( 0.0433, 0.0113, 0.8956 )
);
vec3 agxDefaultContrastApprox( vec3 x ) {
	vec3 x2 = x * x;
	vec3 x4 = x2 * x2;
	return + 15.5 * x4 * x2
		- 40.14 * x4 * x
		+ 31.96 * x4
		- 6.868 * x2 * x
		+ 0.4298 * x2
		+ 0.1191 * x
		- 0.00232;
}
vec3 AgXToneMapping( vec3 color ) {
	const mat3 AgXInsetMatrix = mat3(
		vec3( 0.856627153315983, 0.137318972929847, 0.11189821299995 ),
		vec3( 0.0951212405381588, 0.761241990602591, 0.0767994186031903 ),
		vec3( 0.0482516061458583, 0.101439036467562, 0.811302368396859 )
	);
	const mat3 AgXOutsetMatrix = mat3(
		vec3( 1.1271005818144368, - 0.1413297634984383, - 0.14132976349843826 ),
		vec3( - 0.11060664309660323, 1.157823702216272, - 0.11060664309660294 ),
		vec3( - 0.016493938717834573, - 0.016493938717834257, 1.2519364065950405 )
	);
	const float AgxMinEv = - 12.47393;	const float AgxMaxEv = 4.026069;
	color *= toneMappingExposure;
	color = LINEAR_SRGB_TO_LINEAR_REC2020 * color;
	color = AgXInsetMatrix * color;
	color = max( color, 1e-10 );	color = log2( color );
	color = ( color - AgxMinEv ) / ( AgxMaxEv - AgxMinEv );
	color = clamp( color, 0.0, 1.0 );
	color = agxDefaultContrastApprox( color );
	color = AgXOutsetMatrix * color;
	color = pow( max( vec3( 0.0 ), color ), vec3( 2.2 ) );
	color = LINEAR_REC2020_TO_LINEAR_SRGB * color;
	color = clamp( color, 0.0, 1.0 );
	return color;
}
vec3 NeutralToneMapping( vec3 color ) {
	const float StartCompression = 0.8 - 0.04;
	const float Desaturation = 0.15;
	color *= toneMappingExposure;
	float x = min( color.r, min( color.g, color.b ) );
	float offset = x < 0.08 ? x - 6.25 * x * x : 0.04;
	color -= offset;
	float peak = max( color.r, max( color.g, color.b ) );
	if ( peak < StartCompression ) return color;
	float d = 1. - StartCompression;
	float newPeak = 1. - d * d / ( peak + d - StartCompression );
	color *= newPeak / peak;
	float g = 1. - 1. / ( Desaturation * ( peak - newPeak ) + 1. );
	return mix( color, vec3( newPeak ), g );
}
vec3 CustomToneMapping( vec3 color ) { return color; }`,pm=`#ifdef USE_TRANSMISSION
	material.transmission = transmission;
	material.transmissionAlpha = 1.0;
	material.thickness = thickness;
	material.attenuationDistance = attenuationDistance;
	material.attenuationColor = attenuationColor;
	#ifdef USE_TRANSMISSIONMAP
		material.transmission *= texture2D( transmissionMap, vTransmissionMapUv ).r;
	#endif
	#ifdef USE_THICKNESSMAP
		material.thickness *= texture2D( thicknessMap, vThicknessMapUv ).g;
	#endif
	vec3 pos = vWorldPosition;
	vec3 v = normalize( cameraPosition - pos );
	vec3 n = inverseTransformDirection( normal, viewMatrix );
	vec4 transmitted = getIBLVolumeRefraction(
		n, v, material.roughness, material.diffuseColor, material.specularColor, material.specularF90,
		pos, modelMatrix, viewMatrix, projectionMatrix, material.dispersion, material.ior, material.thickness,
		material.attenuationColor, material.attenuationDistance );
	material.transmissionAlpha = mix( material.transmissionAlpha, transmitted.a, material.transmission );
	totalDiffuse = mix( totalDiffuse, transmitted.rgb, material.transmission );
#endif`,mm=`#ifdef USE_TRANSMISSION
	uniform float transmission;
	uniform float thickness;
	uniform float attenuationDistance;
	uniform vec3 attenuationColor;
	#ifdef USE_TRANSMISSIONMAP
		uniform sampler2D transmissionMap;
	#endif
	#ifdef USE_THICKNESSMAP
		uniform sampler2D thicknessMap;
	#endif
	uniform vec2 transmissionSamplerSize;
	uniform sampler2D transmissionSamplerMap;
	uniform mat4 modelMatrix;
	uniform mat4 projectionMatrix;
	varying vec3 vWorldPosition;
	float w0( float a ) {
		return ( 1.0 / 6.0 ) * ( a * ( a * ( - a + 3.0 ) - 3.0 ) + 1.0 );
	}
	float w1( float a ) {
		return ( 1.0 / 6.0 ) * ( a *  a * ( 3.0 * a - 6.0 ) + 4.0 );
	}
	float w2( float a ){
		return ( 1.0 / 6.0 ) * ( a * ( a * ( - 3.0 * a + 3.0 ) + 3.0 ) + 1.0 );
	}
	float w3( float a ) {
		return ( 1.0 / 6.0 ) * ( a * a * a );
	}
	float g0( float a ) {
		return w0( a ) + w1( a );
	}
	float g1( float a ) {
		return w2( a ) + w3( a );
	}
	float h0( float a ) {
		return - 1.0 + w1( a ) / ( w0( a ) + w1( a ) );
	}
	float h1( float a ) {
		return 1.0 + w3( a ) / ( w2( a ) + w3( a ) );
	}
	vec4 bicubic( sampler2D tex, vec2 uv, vec4 texelSize, float lod ) {
		uv = uv * texelSize.zw + 0.5;
		vec2 iuv = floor( uv );
		vec2 fuv = fract( uv );
		float g0x = g0( fuv.x );
		float g1x = g1( fuv.x );
		float h0x = h0( fuv.x );
		float h1x = h1( fuv.x );
		float h0y = h0( fuv.y );
		float h1y = h1( fuv.y );
		vec2 p0 = ( vec2( iuv.x + h0x, iuv.y + h0y ) - 0.5 ) * texelSize.xy;
		vec2 p1 = ( vec2( iuv.x + h1x, iuv.y + h0y ) - 0.5 ) * texelSize.xy;
		vec2 p2 = ( vec2( iuv.x + h0x, iuv.y + h1y ) - 0.5 ) * texelSize.xy;
		vec2 p3 = ( vec2( iuv.x + h1x, iuv.y + h1y ) - 0.5 ) * texelSize.xy;
		return g0( fuv.y ) * ( g0x * textureLod( tex, p0, lod ) + g1x * textureLod( tex, p1, lod ) ) +
			g1( fuv.y ) * ( g0x * textureLod( tex, p2, lod ) + g1x * textureLod( tex, p3, lod ) );
	}
	vec4 textureBicubic( sampler2D sampler, vec2 uv, float lod ) {
		vec2 fLodSize = vec2( textureSize( sampler, int( lod ) ) );
		vec2 cLodSize = vec2( textureSize( sampler, int( lod + 1.0 ) ) );
		vec2 fLodSizeInv = 1.0 / fLodSize;
		vec2 cLodSizeInv = 1.0 / cLodSize;
		vec4 fSample = bicubic( sampler, uv, vec4( fLodSizeInv, fLodSize ), floor( lod ) );
		vec4 cSample = bicubic( sampler, uv, vec4( cLodSizeInv, cLodSize ), ceil( lod ) );
		return mix( fSample, cSample, fract( lod ) );
	}
	vec3 getVolumeTransmissionRay( const in vec3 n, const in vec3 v, const in float thickness, const in float ior, const in mat4 modelMatrix ) {
		vec3 refractionVector = refract( - v, normalize( n ), 1.0 / ior );
		vec3 modelScale;
		modelScale.x = length( vec3( modelMatrix[ 0 ].xyz ) );
		modelScale.y = length( vec3( modelMatrix[ 1 ].xyz ) );
		modelScale.z = length( vec3( modelMatrix[ 2 ].xyz ) );
		return normalize( refractionVector ) * thickness * modelScale;
	}
	float applyIorToRoughness( const in float roughness, const in float ior ) {
		return roughness * clamp( ior * 2.0 - 2.0, 0.0, 1.0 );
	}
	vec4 getTransmissionSample( const in vec2 fragCoord, const in float roughness, const in float ior ) {
		float lod = log2( transmissionSamplerSize.x ) * applyIorToRoughness( roughness, ior );
		return textureBicubic( transmissionSamplerMap, fragCoord.xy, lod );
	}
	vec3 volumeAttenuation( const in float transmissionDistance, const in vec3 attenuationColor, const in float attenuationDistance ) {
		if ( isinf( attenuationDistance ) ) {
			return vec3( 1.0 );
		} else {
			vec3 attenuationCoefficient = -log( attenuationColor ) / attenuationDistance;
			vec3 transmittance = exp( - attenuationCoefficient * transmissionDistance );			return transmittance;
		}
	}
	vec4 getIBLVolumeRefraction( const in vec3 n, const in vec3 v, const in float roughness, const in vec3 diffuseColor,
		const in vec3 specularColor, const in float specularF90, const in vec3 position, const in mat4 modelMatrix,
		const in mat4 viewMatrix, const in mat4 projMatrix, const in float dispersion, const in float ior, const in float thickness,
		const in vec3 attenuationColor, const in float attenuationDistance ) {
		vec4 transmittedLight;
		vec3 transmittance;
		#ifdef USE_DISPERSION
			float halfSpread = ( ior - 1.0 ) * 0.025 * dispersion;
			vec3 iors = vec3( ior - halfSpread, ior, ior + halfSpread );
			for ( int i = 0; i < 3; i ++ ) {
				vec3 transmissionRay = getVolumeTransmissionRay( n, v, thickness, iors[ i ], modelMatrix );
				vec3 refractedRayExit = position + transmissionRay;
		
				vec4 ndcPos = projMatrix * viewMatrix * vec4( refractedRayExit, 1.0 );
				vec2 refractionCoords = ndcPos.xy / ndcPos.w;
				refractionCoords += 1.0;
				refractionCoords /= 2.0;
		
				vec4 transmissionSample = getTransmissionSample( refractionCoords, roughness, iors[ i ] );
				transmittedLight[ i ] = transmissionSample[ i ];
				transmittedLight.a += transmissionSample.a;
				transmittance[ i ] = diffuseColor[ i ] * volumeAttenuation( length( transmissionRay ), attenuationColor, attenuationDistance )[ i ];
			}
			transmittedLight.a /= 3.0;
		
		#else
		
			vec3 transmissionRay = getVolumeTransmissionRay( n, v, thickness, ior, modelMatrix );
			vec3 refractedRayExit = position + transmissionRay;
			vec4 ndcPos = projMatrix * viewMatrix * vec4( refractedRayExit, 1.0 );
			vec2 refractionCoords = ndcPos.xy / ndcPos.w;
			refractionCoords += 1.0;
			refractionCoords /= 2.0;
			transmittedLight = getTransmissionSample( refractionCoords, roughness, ior );
			transmittance = diffuseColor * volumeAttenuation( length( transmissionRay ), attenuationColor, attenuationDistance );
		
		#endif
		vec3 attenuatedColor = transmittance * transmittedLight.rgb;
		vec3 F = EnvironmentBRDF( n, v, specularColor, specularF90, roughness );
		float transmittanceFactor = ( transmittance.r + transmittance.g + transmittance.b ) / 3.0;
		return vec4( ( 1.0 - F ) * attenuatedColor, 1.0 - ( 1.0 - transmittedLight.a ) * transmittanceFactor );
	}
#endif`,gm=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	varying vec2 vUv;
#endif
#ifdef USE_MAP
	varying vec2 vMapUv;
#endif
#ifdef USE_ALPHAMAP
	varying vec2 vAlphaMapUv;
#endif
#ifdef USE_LIGHTMAP
	varying vec2 vLightMapUv;
#endif
#ifdef USE_AOMAP
	varying vec2 vAoMapUv;
#endif
#ifdef USE_BUMPMAP
	varying vec2 vBumpMapUv;
#endif
#ifdef USE_NORMALMAP
	varying vec2 vNormalMapUv;
#endif
#ifdef USE_EMISSIVEMAP
	varying vec2 vEmissiveMapUv;
#endif
#ifdef USE_METALNESSMAP
	varying vec2 vMetalnessMapUv;
#endif
#ifdef USE_ROUGHNESSMAP
	varying vec2 vRoughnessMapUv;
#endif
#ifdef USE_ANISOTROPYMAP
	varying vec2 vAnisotropyMapUv;
#endif
#ifdef USE_CLEARCOATMAP
	varying vec2 vClearcoatMapUv;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	varying vec2 vClearcoatNormalMapUv;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	varying vec2 vClearcoatRoughnessMapUv;
#endif
#ifdef USE_IRIDESCENCEMAP
	varying vec2 vIridescenceMapUv;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	varying vec2 vIridescenceThicknessMapUv;
#endif
#ifdef USE_SHEEN_COLORMAP
	varying vec2 vSheenColorMapUv;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	varying vec2 vSheenRoughnessMapUv;
#endif
#ifdef USE_SPECULARMAP
	varying vec2 vSpecularMapUv;
#endif
#ifdef USE_SPECULAR_COLORMAP
	varying vec2 vSpecularColorMapUv;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	varying vec2 vSpecularIntensityMapUv;
#endif
#ifdef USE_TRANSMISSIONMAP
	uniform mat3 transmissionMapTransform;
	varying vec2 vTransmissionMapUv;
#endif
#ifdef USE_THICKNESSMAP
	uniform mat3 thicknessMapTransform;
	varying vec2 vThicknessMapUv;
#endif`,vm=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	varying vec2 vUv;
#endif
#ifdef USE_MAP
	uniform mat3 mapTransform;
	varying vec2 vMapUv;
#endif
#ifdef USE_ALPHAMAP
	uniform mat3 alphaMapTransform;
	varying vec2 vAlphaMapUv;
#endif
#ifdef USE_LIGHTMAP
	uniform mat3 lightMapTransform;
	varying vec2 vLightMapUv;
#endif
#ifdef USE_AOMAP
	uniform mat3 aoMapTransform;
	varying vec2 vAoMapUv;
#endif
#ifdef USE_BUMPMAP
	uniform mat3 bumpMapTransform;
	varying vec2 vBumpMapUv;
#endif
#ifdef USE_NORMALMAP
	uniform mat3 normalMapTransform;
	varying vec2 vNormalMapUv;
#endif
#ifdef USE_DISPLACEMENTMAP
	uniform mat3 displacementMapTransform;
	varying vec2 vDisplacementMapUv;
#endif
#ifdef USE_EMISSIVEMAP
	uniform mat3 emissiveMapTransform;
	varying vec2 vEmissiveMapUv;
#endif
#ifdef USE_METALNESSMAP
	uniform mat3 metalnessMapTransform;
	varying vec2 vMetalnessMapUv;
#endif
#ifdef USE_ROUGHNESSMAP
	uniform mat3 roughnessMapTransform;
	varying vec2 vRoughnessMapUv;
#endif
#ifdef USE_ANISOTROPYMAP
	uniform mat3 anisotropyMapTransform;
	varying vec2 vAnisotropyMapUv;
#endif
#ifdef USE_CLEARCOATMAP
	uniform mat3 clearcoatMapTransform;
	varying vec2 vClearcoatMapUv;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	uniform mat3 clearcoatNormalMapTransform;
	varying vec2 vClearcoatNormalMapUv;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	uniform mat3 clearcoatRoughnessMapTransform;
	varying vec2 vClearcoatRoughnessMapUv;
#endif
#ifdef USE_SHEEN_COLORMAP
	uniform mat3 sheenColorMapTransform;
	varying vec2 vSheenColorMapUv;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	uniform mat3 sheenRoughnessMapTransform;
	varying vec2 vSheenRoughnessMapUv;
#endif
#ifdef USE_IRIDESCENCEMAP
	uniform mat3 iridescenceMapTransform;
	varying vec2 vIridescenceMapUv;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	uniform mat3 iridescenceThicknessMapTransform;
	varying vec2 vIridescenceThicknessMapUv;
#endif
#ifdef USE_SPECULARMAP
	uniform mat3 specularMapTransform;
	varying vec2 vSpecularMapUv;
#endif
#ifdef USE_SPECULAR_COLORMAP
	uniform mat3 specularColorMapTransform;
	varying vec2 vSpecularColorMapUv;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	uniform mat3 specularIntensityMapTransform;
	varying vec2 vSpecularIntensityMapUv;
#endif
#ifdef USE_TRANSMISSIONMAP
	uniform mat3 transmissionMapTransform;
	varying vec2 vTransmissionMapUv;
#endif
#ifdef USE_THICKNESSMAP
	uniform mat3 thicknessMapTransform;
	varying vec2 vThicknessMapUv;
#endif`,xm=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	vUv = vec3( uv, 1 ).xy;
#endif
#ifdef USE_MAP
	vMapUv = ( mapTransform * vec3( MAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ALPHAMAP
	vAlphaMapUv = ( alphaMapTransform * vec3( ALPHAMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_LIGHTMAP
	vLightMapUv = ( lightMapTransform * vec3( LIGHTMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_AOMAP
	vAoMapUv = ( aoMapTransform * vec3( AOMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_BUMPMAP
	vBumpMapUv = ( bumpMapTransform * vec3( BUMPMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_NORMALMAP
	vNormalMapUv = ( normalMapTransform * vec3( NORMALMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_DISPLACEMENTMAP
	vDisplacementMapUv = ( displacementMapTransform * vec3( DISPLACEMENTMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_EMISSIVEMAP
	vEmissiveMapUv = ( emissiveMapTransform * vec3( EMISSIVEMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_METALNESSMAP
	vMetalnessMapUv = ( metalnessMapTransform * vec3( METALNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ROUGHNESSMAP
	vRoughnessMapUv = ( roughnessMapTransform * vec3( ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ANISOTROPYMAP
	vAnisotropyMapUv = ( anisotropyMapTransform * vec3( ANISOTROPYMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOATMAP
	vClearcoatMapUv = ( clearcoatMapTransform * vec3( CLEARCOATMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	vClearcoatNormalMapUv = ( clearcoatNormalMapTransform * vec3( CLEARCOAT_NORMALMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	vClearcoatRoughnessMapUv = ( clearcoatRoughnessMapTransform * vec3( CLEARCOAT_ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_IRIDESCENCEMAP
	vIridescenceMapUv = ( iridescenceMapTransform * vec3( IRIDESCENCEMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	vIridescenceThicknessMapUv = ( iridescenceThicknessMapTransform * vec3( IRIDESCENCE_THICKNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SHEEN_COLORMAP
	vSheenColorMapUv = ( sheenColorMapTransform * vec3( SHEEN_COLORMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	vSheenRoughnessMapUv = ( sheenRoughnessMapTransform * vec3( SHEEN_ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULARMAP
	vSpecularMapUv = ( specularMapTransform * vec3( SPECULARMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULAR_COLORMAP
	vSpecularColorMapUv = ( specularColorMapTransform * vec3( SPECULAR_COLORMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	vSpecularIntensityMapUv = ( specularIntensityMapTransform * vec3( SPECULAR_INTENSITYMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_TRANSMISSIONMAP
	vTransmissionMapUv = ( transmissionMapTransform * vec3( TRANSMISSIONMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_THICKNESSMAP
	vThicknessMapUv = ( thicknessMapTransform * vec3( THICKNESSMAP_UV, 1 ) ).xy;
#endif`,_m=`#if defined( USE_ENVMAP ) || defined( DISTANCE ) || defined ( USE_SHADOWMAP ) || defined ( USE_TRANSMISSION ) || NUM_SPOT_LIGHT_COORDS > 0
	vec4 worldPosition = vec4( transformed, 1.0 );
	#ifdef USE_BATCHING
		worldPosition = batchingMatrix * worldPosition;
	#endif
	#ifdef USE_INSTANCING
		worldPosition = instanceMatrix * worldPosition;
	#endif
	worldPosition = modelMatrix * worldPosition;
#endif`;const ym=`varying vec2 vUv;
uniform mat3 uvTransform;
void main() {
	vUv = ( uvTransform * vec3( uv, 1 ) ).xy;
	gl_Position = vec4( position.xy, 1.0, 1.0 );
}`,Mm=`uniform sampler2D t2D;
uniform float backgroundIntensity;
varying vec2 vUv;
void main() {
	vec4 texColor = texture2D( t2D, vUv );
	#ifdef DECODE_VIDEO_TEXTURE
		texColor = vec4( mix( pow( texColor.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), texColor.rgb * 0.0773993808, vec3( lessThanEqual( texColor.rgb, vec3( 0.04045 ) ) ) ), texColor.w );
	#endif
	texColor.rgb *= backgroundIntensity;
	gl_FragColor = texColor;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,bm=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
	gl_Position.z = gl_Position.w;
}`,Sm=`#ifdef ENVMAP_TYPE_CUBE
	uniform samplerCube envMap;
#elif defined( ENVMAP_TYPE_CUBE_UV )
	uniform sampler2D envMap;
#endif
uniform float flipEnvMap;
uniform float backgroundBlurriness;
uniform float backgroundIntensity;
uniform mat3 backgroundRotation;
varying vec3 vWorldDirection;
#include <cube_uv_reflection_fragment>
void main() {
	#ifdef ENVMAP_TYPE_CUBE
		vec4 texColor = textureCube( envMap, backgroundRotation * vec3( flipEnvMap * vWorldDirection.x, vWorldDirection.yz ) );
	#elif defined( ENVMAP_TYPE_CUBE_UV )
		vec4 texColor = textureCubeUV( envMap, backgroundRotation * vWorldDirection, backgroundBlurriness );
	#else
		vec4 texColor = vec4( 0.0, 0.0, 0.0, 1.0 );
	#endif
	texColor.rgb *= backgroundIntensity;
	gl_FragColor = texColor;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,wm=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
	gl_Position.z = gl_Position.w;
}`,Tm=`uniform samplerCube tCube;
uniform float tFlip;
uniform float opacity;
varying vec3 vWorldDirection;
void main() {
	vec4 texColor = textureCube( tCube, vec3( tFlip * vWorldDirection.x, vWorldDirection.yz ) );
	gl_FragColor = texColor;
	gl_FragColor.a *= opacity;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,Em=`#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
varying vec2 vHighPrecisionZW;
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <skinbase_vertex>
	#include <morphinstance_vertex>
	#ifdef USE_DISPLACEMENTMAP
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vHighPrecisionZW = gl_Position.zw;
}`,Am=`#if DEPTH_PACKING == 3200
	uniform float opacity;
#endif
#include <common>
#include <packing>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
varying vec2 vHighPrecisionZW;
void main() {
	vec4 diffuseColor = vec4( 1.0 );
	#include <clipping_planes_fragment>
	#if DEPTH_PACKING == 3200
		diffuseColor.a = opacity;
	#endif
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <logdepthbuf_fragment>
	float fragCoordZ = 0.5 * vHighPrecisionZW[0] / vHighPrecisionZW[1] + 0.5;
	#if DEPTH_PACKING == 3200
		gl_FragColor = vec4( vec3( 1.0 - fragCoordZ ), opacity );
	#elif DEPTH_PACKING == 3201
		gl_FragColor = packDepthToRGBA( fragCoordZ );
	#elif DEPTH_PACKING == 3202
		gl_FragColor = vec4( packDepthToRGB( fragCoordZ ), 1.0 );
	#elif DEPTH_PACKING == 3203
		gl_FragColor = vec4( packDepthToRG( fragCoordZ ), 0.0, 1.0 );
	#endif
}`,Rm=`#define DISTANCE
varying vec3 vWorldPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <skinbase_vertex>
	#include <morphinstance_vertex>
	#ifdef USE_DISPLACEMENTMAP
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <worldpos_vertex>
	#include <clipping_planes_vertex>
	vWorldPosition = worldPosition.xyz;
}`,Cm=`#define DISTANCE
uniform vec3 referencePosition;
uniform float nearDistance;
uniform float farDistance;
varying vec3 vWorldPosition;
#include <common>
#include <packing>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <clipping_planes_pars_fragment>
void main () {
	vec4 diffuseColor = vec4( 1.0 );
	#include <clipping_planes_fragment>
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	float dist = length( vWorldPosition - referencePosition );
	dist = ( dist - nearDistance ) / ( farDistance - nearDistance );
	dist = saturate( dist );
	gl_FragColor = packDepthToRGBA( dist );
}`,Pm=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
}`,Lm=`uniform sampler2D tEquirect;
varying vec3 vWorldDirection;
#include <common>
void main() {
	vec3 direction = normalize( vWorldDirection );
	vec2 sampleUV = equirectUv( direction );
	gl_FragColor = texture2D( tEquirect, sampleUV );
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,km=`uniform float scale;
attribute float lineDistance;
varying float vLineDistance;
#include <common>
#include <uv_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	vLineDistance = scale * lineDistance;
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
}`,Dm=`uniform vec3 diffuse;
uniform float opacity;
uniform float dashSize;
uniform float totalSize;
varying float vLineDistance;
#include <common>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	if ( mod( vLineDistance, totalSize ) > dashSize ) {
		discard;
	}
	vec3 outgoingLight = vec3( 0.0 );
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
}`,Im=`#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#if defined ( USE_ENVMAP ) || defined ( USE_SKINNING )
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinbase_vertex>
		#include <skinnormal_vertex>
		#include <defaultnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <fog_vertex>
}`,Nm=`uniform vec3 diffuse;
uniform float opacity;
#ifndef FLAT_SHADED
	varying vec3 vNormal;
#endif
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <fog_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	#ifdef USE_LIGHTMAP
		vec4 lightMapTexel = texture2D( lightMap, vLightMapUv );
		reflectedLight.indirectDiffuse += lightMapTexel.rgb * lightMapIntensity * RECIPROCAL_PI;
	#else
		reflectedLight.indirectDiffuse += vec3( 1.0 );
	#endif
	#include <aomap_fragment>
	reflectedLight.indirectDiffuse *= diffuseColor.rgb;
	vec3 outgoingLight = reflectedLight.indirectDiffuse;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,Um=`#define LAMBERT
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,zm=`#define LAMBERT
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float opacity;
#include <common>
#include <packing>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_lambert_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_lambert_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,Fm=`#define MATCAP
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <color_pars_vertex>
#include <displacementmap_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
	vViewPosition = - mvPosition.xyz;
}`,Bm=`#define MATCAP
uniform vec3 diffuse;
uniform float opacity;
uniform sampler2D matcap;
varying vec3 vViewPosition;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <normal_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	vec3 viewDir = normalize( vViewPosition );
	vec3 x = normalize( vec3( viewDir.z, 0.0, - viewDir.x ) );
	vec3 y = cross( viewDir, x );
	vec2 uv = vec2( dot( x, normal ), dot( y, normal ) ) * 0.495 + 0.5;
	#ifdef USE_MATCAP
		vec4 matcapColor = texture2D( matcap, uv );
	#else
		vec4 matcapColor = vec4( vec3( mix( 0.2, 0.8, uv.y ) ), 1.0 );
	#endif
	vec3 outgoingLight = diffuseColor.rgb * matcapColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,Om=`#define NORMAL
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	varying vec3 vViewPosition;
#endif
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	vViewPosition = - mvPosition.xyz;
#endif
}`,Hm=`#define NORMAL
uniform float opacity;
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	varying vec3 vViewPosition;
#endif
#include <packing>
#include <uv_pars_fragment>
#include <normal_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( 0.0, 0.0, 0.0, opacity );
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	gl_FragColor = vec4( packNormalToRGB( normal ), diffuseColor.a );
	#ifdef OPAQUE
		gl_FragColor.a = 1.0;
	#endif
}`,Vm=`#define PHONG
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,Gm=`#define PHONG
uniform vec3 diffuse;
uniform vec3 emissive;
uniform vec3 specular;
uniform float shininess;
uniform float opacity;
#include <common>
#include <packing>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_phong_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_phong_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + reflectedLight.directSpecular + reflectedLight.indirectSpecular + totalEmissiveRadiance;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,Wm=`#define STANDARD
varying vec3 vViewPosition;
#ifdef USE_TRANSMISSION
	varying vec3 vWorldPosition;
#endif
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
#ifdef USE_TRANSMISSION
	vWorldPosition = worldPosition.xyz;
#endif
}`,qm=`#define STANDARD
#ifdef PHYSICAL
	#define IOR
	#define USE_SPECULAR
#endif
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float roughness;
uniform float metalness;
uniform float opacity;
#ifdef IOR
	uniform float ior;
#endif
#ifdef USE_SPECULAR
	uniform float specularIntensity;
	uniform vec3 specularColor;
	#ifdef USE_SPECULAR_COLORMAP
		uniform sampler2D specularColorMap;
	#endif
	#ifdef USE_SPECULAR_INTENSITYMAP
		uniform sampler2D specularIntensityMap;
	#endif
#endif
#ifdef USE_CLEARCOAT
	uniform float clearcoat;
	uniform float clearcoatRoughness;
#endif
#ifdef USE_DISPERSION
	uniform float dispersion;
#endif
#ifdef USE_IRIDESCENCE
	uniform float iridescence;
	uniform float iridescenceIOR;
	uniform float iridescenceThicknessMinimum;
	uniform float iridescenceThicknessMaximum;
#endif
#ifdef USE_SHEEN
	uniform vec3 sheenColor;
	uniform float sheenRoughness;
	#ifdef USE_SHEEN_COLORMAP
		uniform sampler2D sheenColorMap;
	#endif
	#ifdef USE_SHEEN_ROUGHNESSMAP
		uniform sampler2D sheenRoughnessMap;
	#endif
#endif
#ifdef USE_ANISOTROPY
	uniform vec2 anisotropyVector;
	#ifdef USE_ANISOTROPYMAP
		uniform sampler2D anisotropyMap;
	#endif
#endif
varying vec3 vViewPosition;
#include <common>
#include <packing>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <iridescence_fragment>
#include <cube_uv_reflection_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_physical_pars_fragment>
#include <fog_pars_fragment>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_physical_pars_fragment>
#include <transmission_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <clearcoat_pars_fragment>
#include <iridescence_pars_fragment>
#include <roughnessmap_pars_fragment>
#include <metalnessmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <roughnessmap_fragment>
	#include <metalnessmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <clearcoat_normal_fragment_begin>
	#include <clearcoat_normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_physical_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 totalDiffuse = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse;
	vec3 totalSpecular = reflectedLight.directSpecular + reflectedLight.indirectSpecular;
	#include <transmission_fragment>
	vec3 outgoingLight = totalDiffuse + totalSpecular + totalEmissiveRadiance;
	#ifdef USE_SHEEN
		float sheenEnergyComp = 1.0 - 0.157 * max3( material.sheenColor );
		outgoingLight = outgoingLight * sheenEnergyComp + sheenSpecularDirect + sheenSpecularIndirect;
	#endif
	#ifdef USE_CLEARCOAT
		float dotNVcc = saturate( dot( geometryClearcoatNormal, geometryViewDir ) );
		vec3 Fcc = F_Schlick( material.clearcoatF0, material.clearcoatF90, dotNVcc );
		outgoingLight = outgoingLight * ( 1.0 - material.clearcoat * Fcc ) + ( clearcoatSpecularDirect + clearcoatSpecularIndirect ) * material.clearcoat;
	#endif
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,Xm=`#define TOON
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,jm=`#define TOON
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float opacity;
#include <common>
#include <packing>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <gradientmap_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_toon_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_toon_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,Ym=`uniform float size;
uniform float scale;
#include <common>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
#ifdef USE_POINTS_UV
	varying vec2 vUv;
	uniform mat3 uvTransform;
#endif
void main() {
	#ifdef USE_POINTS_UV
		vUv = ( uvTransform * vec3( uv, 1 ) ).xy;
	#endif
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <project_vertex>
	gl_PointSize = size;
	#ifdef USE_SIZEATTENUATION
		bool isPerspective = isPerspectiveMatrix( projectionMatrix );
		if ( isPerspective ) gl_PointSize *= ( scale / - mvPosition.z );
	#endif
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <worldpos_vertex>
	#include <fog_vertex>
}`,$m=`uniform vec3 diffuse;
uniform float opacity;
#include <common>
#include <color_pars_fragment>
#include <map_particle_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	vec3 outgoingLight = vec3( 0.0 );
	#include <logdepthbuf_fragment>
	#include <map_particle_fragment>
	#include <color_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
}`,Km=`#include <common>
#include <batching_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <shadowmap_pars_vertex>
void main() {
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,Zm=`uniform vec3 color;
uniform float opacity;
#include <common>
#include <packing>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <logdepthbuf_pars_fragment>
#include <shadowmap_pars_fragment>
#include <shadowmask_pars_fragment>
void main() {
	#include <logdepthbuf_fragment>
	gl_FragColor = vec4( color, opacity * ( 1.0 - getShadowMask() ) );
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
}`,Jm=`uniform float rotation;
uniform vec2 center;
#include <common>
#include <uv_pars_vertex>
#include <fog_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	vec4 mvPosition = modelViewMatrix[ 3 ];
	vec2 scale = vec2( length( modelMatrix[ 0 ].xyz ), length( modelMatrix[ 1 ].xyz ) );
	#ifndef USE_SIZEATTENUATION
		bool isPerspective = isPerspectiveMatrix( projectionMatrix );
		if ( isPerspective ) scale *= - mvPosition.z;
	#endif
	vec2 alignedPosition = ( position.xy - ( center - vec2( 0.5 ) ) ) * scale;
	vec2 rotatedPosition;
	rotatedPosition.x = cos( rotation ) * alignedPosition.x - sin( rotation ) * alignedPosition.y;
	rotatedPosition.y = sin( rotation ) * alignedPosition.x + cos( rotation ) * alignedPosition.y;
	mvPosition.xy += rotatedPosition;
	gl_Position = projectionMatrix * mvPosition;
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
}`,Qm=`uniform vec3 diffuse;
uniform float opacity;
#include <common>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	vec3 outgoingLight = vec3( 0.0 );
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
}`,ee={alphahash_fragment:Mf,alphahash_pars_fragment:bf,alphamap_fragment:Sf,alphamap_pars_fragment:wf,alphatest_fragment:Tf,alphatest_pars_fragment:Ef,aomap_fragment:Af,aomap_pars_fragment:Rf,batching_pars_vertex:Cf,batching_vertex:Pf,begin_vertex:Lf,beginnormal_vertex:kf,bsdfs:Df,iridescence_fragment:If,bumpmap_pars_fragment:Nf,clipping_planes_fragment:Uf,clipping_planes_pars_fragment:zf,clipping_planes_pars_vertex:Ff,clipping_planes_vertex:Bf,color_fragment:Of,color_pars_fragment:Hf,color_pars_vertex:Vf,color_vertex:Gf,common:Wf,cube_uv_reflection_fragment:qf,defaultnormal_vertex:Xf,displacementmap_pars_vertex:jf,displacementmap_vertex:Yf,emissivemap_fragment:$f,emissivemap_pars_fragment:Kf,colorspace_fragment:Zf,colorspace_pars_fragment:Jf,envmap_fragment:Qf,envmap_common_pars_fragment:tp,envmap_pars_fragment:ep,envmap_pars_vertex:np,envmap_physical_pars_fragment:fp,envmap_vertex:ip,fog_vertex:sp,fog_pars_vertex:rp,fog_fragment:op,fog_pars_fragment:ap,gradientmap_pars_fragment:cp,lightmap_pars_fragment:lp,lights_lambert_fragment:hp,lights_lambert_pars_fragment:up,lights_pars_begin:dp,lights_toon_fragment:pp,lights_toon_pars_fragment:mp,lights_phong_fragment:gp,lights_phong_pars_fragment:vp,lights_physical_fragment:xp,lights_physical_pars_fragment:_p,lights_fragment_begin:yp,lights_fragment_maps:Mp,lights_fragment_end:bp,logdepthbuf_fragment:Sp,logdepthbuf_pars_fragment:wp,logdepthbuf_pars_vertex:Tp,logdepthbuf_vertex:Ep,map_fragment:Ap,map_pars_fragment:Rp,map_particle_fragment:Cp,map_particle_pars_fragment:Pp,metalnessmap_fragment:Lp,metalnessmap_pars_fragment:kp,morphinstance_vertex:Dp,morphcolor_vertex:Ip,morphnormal_vertex:Np,morphtarget_pars_vertex:Up,morphtarget_vertex:zp,normal_fragment_begin:Fp,normal_fragment_maps:Bp,normal_pars_fragment:Op,normal_pars_vertex:Hp,normal_vertex:Vp,normalmap_pars_fragment:Gp,clearcoat_normal_fragment_begin:Wp,clearcoat_normal_fragment_maps:qp,clearcoat_pars_fragment:Xp,iridescence_pars_fragment:jp,opaque_fragment:Yp,packing:$p,premultiplied_alpha_fragment:Kp,project_vertex:Zp,dithering_fragment:Jp,dithering_pars_fragment:Qp,roughnessmap_fragment:tm,roughnessmap_pars_fragment:em,shadowmap_pars_fragment:nm,shadowmap_pars_vertex:im,shadowmap_vertex:sm,shadowmask_pars_fragment:rm,skinbase_vertex:om,skinning_pars_vertex:am,skinning_vertex:cm,skinnormal_vertex:lm,specularmap_fragment:hm,specularmap_pars_fragment:um,tonemapping_fragment:dm,tonemapping_pars_fragment:fm,transmission_fragment:pm,transmission_pars_fragment:mm,uv_pars_fragment:gm,uv_pars_vertex:vm,uv_vertex:xm,worldpos_vertex:_m,background_vert:ym,background_frag:Mm,backgroundCube_vert:bm,backgroundCube_frag:Sm,cube_vert:wm,cube_frag:Tm,depth_vert:Em,depth_frag:Am,distanceRGBA_vert:Rm,distanceRGBA_frag:Cm,equirect_vert:Pm,equirect_frag:Lm,linedashed_vert:km,linedashed_frag:Dm,meshbasic_vert:Im,meshbasic_frag:Nm,meshlambert_vert:Um,meshlambert_frag:zm,meshmatcap_vert:Fm,meshmatcap_frag:Bm,meshnormal_vert:Om,meshnormal_frag:Hm,meshphong_vert:Vm,meshphong_frag:Gm,meshphysical_vert:Wm,meshphysical_frag:qm,meshtoon_vert:Xm,meshtoon_frag:jm,points_vert:Ym,points_frag:$m,shadow_vert:Km,shadow_frag:Zm,sprite_vert:Jm,sprite_frag:Qm},xt={common:{diffuse:{value:new dt(16777215)},opacity:{value:1},map:{value:null},mapTransform:{value:new Qt},alphaMap:{value:null},alphaMapTransform:{value:new Qt},alphaTest:{value:0}},specularmap:{specularMap:{value:null},specularMapTransform:{value:new Qt}},envmap:{envMap:{value:null},envMapRotation:{value:new Qt},flipEnvMap:{value:-1},reflectivity:{value:1},ior:{value:1.5},refractionRatio:{value:.98}},aomap:{aoMap:{value:null},aoMapIntensity:{value:1},aoMapTransform:{value:new Qt}},lightmap:{lightMap:{value:null},lightMapIntensity:{value:1},lightMapTransform:{value:new Qt}},bumpmap:{bumpMap:{value:null},bumpMapTransform:{value:new Qt},bumpScale:{value:1}},normalmap:{normalMap:{value:null},normalMapTransform:{value:new Qt},normalScale:{value:new ct(1,1)}},displacementmap:{displacementMap:{value:null},displacementMapTransform:{value:new Qt},displacementScale:{value:1},displacementBias:{value:0}},emissivemap:{emissiveMap:{value:null},emissiveMapTransform:{value:new Qt}},metalnessmap:{metalnessMap:{value:null},metalnessMapTransform:{value:new Qt}},roughnessmap:{roughnessMap:{value:null},roughnessMapTransform:{value:new Qt}},gradientmap:{gradientMap:{value:null}},fog:{fogDensity:{value:25e-5},fogNear:{value:1},fogFar:{value:2e3},fogColor:{value:new dt(16777215)}},lights:{ambientLightColor:{value:[]},lightProbe:{value:[]},directionalLights:{value:[],properties:{direction:{},color:{}}},directionalLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},directionalShadowMap:{value:[]},directionalShadowMatrix:{value:[]},spotLights:{value:[],properties:{color:{},position:{},direction:{},distance:{},coneCos:{},penumbraCos:{},decay:{}}},spotLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},spotLightMap:{value:[]},spotShadowMap:{value:[]},spotLightMatrix:{value:[]},pointLights:{value:[],properties:{color:{},position:{},decay:{},distance:{}}},pointLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{},shadowCameraNear:{},shadowCameraFar:{}}},pointShadowMap:{value:[]},pointShadowMatrix:{value:[]},hemisphereLights:{value:[],properties:{direction:{},skyColor:{},groundColor:{}}},rectAreaLights:{value:[],properties:{color:{},position:{},width:{},height:{}}},ltc_1:{value:null},ltc_2:{value:null}},points:{diffuse:{value:new dt(16777215)},opacity:{value:1},size:{value:1},scale:{value:1},map:{value:null},alphaMap:{value:null},alphaMapTransform:{value:new Qt},alphaTest:{value:0},uvTransform:{value:new Qt}},sprite:{diffuse:{value:new dt(16777215)},opacity:{value:1},center:{value:new ct(.5,.5)},rotation:{value:0},map:{value:null},mapTransform:{value:new Qt},alphaMap:{value:null},alphaMapTransform:{value:new Qt},alphaTest:{value:0}}},qn={basic:{uniforms:an([xt.common,xt.specularmap,xt.envmap,xt.aomap,xt.lightmap,xt.fog]),vertexShader:ee.meshbasic_vert,fragmentShader:ee.meshbasic_frag},lambert:{uniforms:an([xt.common,xt.specularmap,xt.envmap,xt.aomap,xt.lightmap,xt.emissivemap,xt.bumpmap,xt.normalmap,xt.displacementmap,xt.fog,xt.lights,{emissive:{value:new dt(0)}}]),vertexShader:ee.meshlambert_vert,fragmentShader:ee.meshlambert_frag},phong:{uniforms:an([xt.common,xt.specularmap,xt.envmap,xt.aomap,xt.lightmap,xt.emissivemap,xt.bumpmap,xt.normalmap,xt.displacementmap,xt.fog,xt.lights,{emissive:{value:new dt(0)},specular:{value:new dt(1118481)},shininess:{value:30}}]),vertexShader:ee.meshphong_vert,fragmentShader:ee.meshphong_frag},standard:{uniforms:an([xt.common,xt.envmap,xt.aomap,xt.lightmap,xt.emissivemap,xt.bumpmap,xt.normalmap,xt.displacementmap,xt.roughnessmap,xt.metalnessmap,xt.fog,xt.lights,{emissive:{value:new dt(0)},roughness:{value:1},metalness:{value:0},envMapIntensity:{value:1}}]),vertexShader:ee.meshphysical_vert,fragmentShader:ee.meshphysical_frag},toon:{uniforms:an([xt.common,xt.aomap,xt.lightmap,xt.emissivemap,xt.bumpmap,xt.normalmap,xt.displacementmap,xt.gradientmap,xt.fog,xt.lights,{emissive:{value:new dt(0)}}]),vertexShader:ee.meshtoon_vert,fragmentShader:ee.meshtoon_frag},matcap:{uniforms:an([xt.common,xt.bumpmap,xt.normalmap,xt.displacementmap,xt.fog,{matcap:{value:null}}]),vertexShader:ee.meshmatcap_vert,fragmentShader:ee.meshmatcap_frag},points:{uniforms:an([xt.points,xt.fog]),vertexShader:ee.points_vert,fragmentShader:ee.points_frag},dashed:{uniforms:an([xt.common,xt.fog,{scale:{value:1},dashSize:{value:1},totalSize:{value:2}}]),vertexShader:ee.linedashed_vert,fragmentShader:ee.linedashed_frag},depth:{uniforms:an([xt.common,xt.displacementmap]),vertexShader:ee.depth_vert,fragmentShader:ee.depth_frag},normal:{uniforms:an([xt.common,xt.bumpmap,xt.normalmap,xt.displacementmap,{opacity:{value:1}}]),vertexShader:ee.meshnormal_vert,fragmentShader:ee.meshnormal_frag},sprite:{uniforms:an([xt.sprite,xt.fog]),vertexShader:ee.sprite_vert,fragmentShader:ee.sprite_frag},background:{uniforms:{uvTransform:{value:new Qt},t2D:{value:null},backgroundIntensity:{value:1}},vertexShader:ee.background_vert,fragmentShader:ee.background_frag},backgroundCube:{uniforms:{envMap:{value:null},flipEnvMap:{value:-1},backgroundBlurriness:{value:0},backgroundIntensity:{value:1},backgroundRotation:{value:new Qt}},vertexShader:ee.backgroundCube_vert,fragmentShader:ee.backgroundCube_frag},cube:{uniforms:{tCube:{value:null},tFlip:{value:-1},opacity:{value:1}},vertexShader:ee.cube_vert,fragmentShader:ee.cube_frag},equirect:{uniforms:{tEquirect:{value:null}},vertexShader:ee.equirect_vert,fragmentShader:ee.equirect_frag},distanceRGBA:{uniforms:an([xt.common,xt.displacementmap,{referencePosition:{value:new A},nearDistance:{value:1},farDistance:{value:1e3}}]),vertexShader:ee.distanceRGBA_vert,fragmentShader:ee.distanceRGBA_frag},shadow:{uniforms:an([xt.lights,xt.fog,{color:{value:new dt(0)},opacity:{value:1}}]),vertexShader:ee.shadow_vert,fragmentShader:ee.shadow_frag}};qn.physical={uniforms:an([qn.standard.uniforms,{clearcoat:{value:0},clearcoatMap:{value:null},clearcoatMapTransform:{value:new Qt},clearcoatNormalMap:{value:null},clearcoatNormalMapTransform:{value:new Qt},clearcoatNormalScale:{value:new ct(1,1)},clearcoatRoughness:{value:0},clearcoatRoughnessMap:{value:null},clearcoatRoughnessMapTransform:{value:new Qt},dispersion:{value:0},iridescence:{value:0},iridescenceMap:{value:null},iridescenceMapTransform:{value:new Qt},iridescenceIOR:{value:1.3},iridescenceThicknessMinimum:{value:100},iridescenceThicknessMaximum:{value:400},iridescenceThicknessMap:{value:null},iridescenceThicknessMapTransform:{value:new Qt},sheen:{value:0},sheenColor:{value:new dt(0)},sheenColorMap:{value:null},sheenColorMapTransform:{value:new Qt},sheenRoughness:{value:1},sheenRoughnessMap:{value:null},sheenRoughnessMapTransform:{value:new Qt},transmission:{value:0},transmissionMap:{value:null},transmissionMapTransform:{value:new Qt},transmissionSamplerSize:{value:new ct},transmissionSamplerMap:{value:null},thickness:{value:0},thicknessMap:{value:null},thicknessMapTransform:{value:new Qt},attenuationDistance:{value:0},attenuationColor:{value:new dt(0)},specularColor:{value:new dt(1,1,1)},specularColorMap:{value:null},specularColorMapTransform:{value:new Qt},specularIntensity:{value:1},specularIntensityMap:{value:null},specularIntensityMapTransform:{value:new Qt},anisotropyVector:{value:new ct},anisotropyMap:{value:null},anisotropyMapTransform:{value:new Qt}}]),vertexShader:ee.meshphysical_vert,fragmentShader:ee.meshphysical_frag};const no={r:0,b:0,g:0},Ki=new Ve,tg=new Dt;function eg(r,t,e,n,i,s,o){const a=new dt(0);let c=s===!0?0:1,l,h,d=null,f=0,u=null;function m(x){let _=x.isScene===!0?x.background:null;return _&&_.isTexture&&(_=(x.backgroundBlurriness>0?e:t).get(_)),_}function v(x){let _=!1;const y=m(x);y===null?g(a,c):y&&y.isColor&&(g(y,1),_=!0);const w=r.xr.getEnvironmentBlendMode();w==="additive"?n.buffers.color.setClear(0,0,0,1,o):w==="alpha-blend"&&n.buffers.color.setClear(0,0,0,0,o),(r.autoClear||_)&&(n.buffers.depth.setTest(!0),n.buffers.depth.setMask(!0),n.buffers.color.setMask(!0),r.clear(r.autoClearColor,r.autoClearDepth,r.autoClearStencil))}function p(x,_){const y=m(_);y&&(y.isCubeTexture||y.mapping===Jo)?(h===void 0&&(h=new Ht(new Vn(1,1,1),new Ye({name:"BackgroundCubeMaterial",uniforms:Ws(qn.backgroundCube.uniforms),vertexShader:qn.backgroundCube.vertexShader,fragmentShader:qn.backgroundCube.fragmentShader,side:sn,depthTest:!1,depthWrite:!1,fog:!1})),h.geometry.deleteAttribute("normal"),h.geometry.deleteAttribute("uv"),h.onBeforeRender=function(w,T,R){this.matrixWorld.copyPosition(R.matrixWorld)},Object.defineProperty(h.material,"envMap",{get:function(){return this.uniforms.envMap.value}}),i.update(h)),Ki.copy(_.backgroundRotation),Ki.x*=-1,Ki.y*=-1,Ki.z*=-1,y.isCubeTexture&&y.isRenderTargetTexture===!1&&(Ki.y*=-1,Ki.z*=-1),h.material.uniforms.envMap.value=y,h.material.uniforms.flipEnvMap.value=y.isCubeTexture&&y.isRenderTargetTexture===!1?-1:1,h.material.uniforms.backgroundBlurriness.value=_.backgroundBlurriness,h.material.uniforms.backgroundIntensity.value=_.backgroundIntensity,h.material.uniforms.backgroundRotation.value.setFromMatrix4(tg.makeRotationFromEuler(Ki)),h.material.toneMapped=me.getTransfer(y.colorSpace)!==Ee,(d!==y||f!==y.version||u!==r.toneMapping)&&(h.material.needsUpdate=!0,d=y,f=y.version,u=r.toneMapping),h.layers.enableAll(),x.unshift(h,h.geometry,h.material,0,0,null)):y&&y.isTexture&&(l===void 0&&(l=new Ht(new vi(2,2),new Ye({name:"BackgroundMaterial",uniforms:Ws(qn.background.uniforms),vertexShader:qn.background.vertexShader,fragmentShader:qn.background.fragmentShader,side:Bi,depthTest:!1,depthWrite:!1,fog:!1})),l.geometry.deleteAttribute("normal"),Object.defineProperty(l.material,"map",{get:function(){return this.uniforms.t2D.value}}),i.update(l)),l.material.uniforms.t2D.value=y,l.material.uniforms.backgroundIntensity.value=_.backgroundIntensity,l.material.toneMapped=me.getTransfer(y.colorSpace)!==Ee,y.matrixAutoUpdate===!0&&y.updateMatrix(),l.material.uniforms.uvTransform.value.copy(y.matrix),(d!==y||f!==y.version||u!==r.toneMapping)&&(l.material.needsUpdate=!0,d=y,f=y.version,u=r.toneMapping),l.layers.enableAll(),x.unshift(l,l.geometry,l.material,0,0,null))}function g(x,_){x.getRGB(no,p0(r)),n.buffers.color.setClear(no.r,no.g,no.b,_,o)}return{getClearColor:function(){return a},setClearColor:function(x,_=1){a.set(x),c=_,g(a,c)},getClearAlpha:function(){return c},setClearAlpha:function(x){c=x,g(a,c)},render:v,addToRenderList:p}}function ng(r,t){const e=r.getParameter(r.MAX_VERTEX_ATTRIBS),n={},i=f(null);let s=i,o=!1;function a(M,S,k,N,z){let H=!1;const L=d(N,k,S);s!==L&&(s=L,l(s.object)),H=u(M,N,k,z),H&&m(M,N,k,z),z!==null&&t.update(z,r.ELEMENT_ARRAY_BUFFER),(H||o)&&(o=!1,y(M,S,k,N),z!==null&&r.bindBuffer(r.ELEMENT_ARRAY_BUFFER,t.get(z).buffer))}function c(){return r.createVertexArray()}function l(M){return r.bindVertexArray(M)}function h(M){return r.deleteVertexArray(M)}function d(M,S,k){const N=k.wireframe===!0;let z=n[M.id];z===void 0&&(z={},n[M.id]=z);let H=z[S.id];H===void 0&&(H={},z[S.id]=H);let L=H[N];return L===void 0&&(L=f(c()),H[N]=L),L}function f(M){const S=[],k=[],N=[];for(let z=0;z<e;z++)S[z]=0,k[z]=0,N[z]=0;return{geometry:null,program:null,wireframe:!1,newAttributes:S,enabledAttributes:k,attributeDivisors:N,object:M,attributes:{},index:null}}function u(M,S,k,N){const z=s.attributes,H=S.attributes;let L=0;const V=k.getAttributes();for(const O in V)if(V[O].location>=0){const B=z[O];let G=H[O];if(G===void 0&&(O==="instanceMatrix"&&M.instanceMatrix&&(G=M.instanceMatrix),O==="instanceColor"&&M.instanceColor&&(G=M.instanceColor)),B===void 0||B.attribute!==G||G&&B.data!==G.data)return!0;L++}return s.attributesNum!==L||s.index!==N}function m(M,S,k,N){const z={},H=S.attributes;let L=0;const V=k.getAttributes();for(const O in V)if(V[O].location>=0){let B=H[O];B===void 0&&(O==="instanceMatrix"&&M.instanceMatrix&&(B=M.instanceMatrix),O==="instanceColor"&&M.instanceColor&&(B=M.instanceColor));const G={};G.attribute=B,B&&B.data&&(G.data=B.data),z[O]=G,L++}s.attributes=z,s.attributesNum=L,s.index=N}function v(){const M=s.newAttributes;for(let S=0,k=M.length;S<k;S++)M[S]=0}function p(M){g(M,0)}function g(M,S){const k=s.newAttributes,N=s.enabledAttributes,z=s.attributeDivisors;k[M]=1,N[M]===0&&(r.enableVertexAttribArray(M),N[M]=1),z[M]!==S&&(r.vertexAttribDivisor(M,S),z[M]=S)}function x(){const M=s.newAttributes,S=s.enabledAttributes;for(let k=0,N=S.length;k<N;k++)S[k]!==M[k]&&(r.disableVertexAttribArray(k),S[k]=0)}function _(M,S,k,N,z,H,L){L===!0?r.vertexAttribIPointer(M,S,k,z,H):r.vertexAttribPointer(M,S,k,N,z,H)}function y(M,S,k,N){v();const z=N.attributes,H=k.getAttributes(),L=S.defaultAttributeValues;for(const V in H){const O=H[V];if(O.location>=0){let P=z[V];if(P===void 0&&(V==="instanceMatrix"&&M.instanceMatrix&&(P=M.instanceMatrix),V==="instanceColor"&&M.instanceColor&&(P=M.instanceColor)),P!==void 0){const B=P.normalized,G=P.itemSize,Q=t.get(P);if(Q===void 0)continue;const ut=Q.buffer,X=Q.type,Z=Q.bytesPerElement,rt=X===r.INT||X===r.UNSIGNED_INT||P.gpuType===dl;if(P.isInterleavedBufferAttribute){const J=P.data,ot=J.stride,lt=P.offset;if(J.isInstancedInterleavedBuffer){for(let bt=0;bt<O.locationSize;bt++)g(O.location+bt,J.meshPerAttribute);M.isInstancedMesh!==!0&&N._maxInstanceCount===void 0&&(N._maxInstanceCount=J.meshPerAttribute*J.count)}else for(let bt=0;bt<O.locationSize;bt++)p(O.location+bt);r.bindBuffer(r.ARRAY_BUFFER,ut);for(let bt=0;bt<O.locationSize;bt++)_(O.location+bt,G/O.locationSize,X,B,ot*Z,(lt+G/O.locationSize*bt)*Z,rt)}else{if(P.isInstancedBufferAttribute){for(let J=0;J<O.locationSize;J++)g(O.location+J,P.meshPerAttribute);M.isInstancedMesh!==!0&&N._maxInstanceCount===void 0&&(N._maxInstanceCount=P.meshPerAttribute*P.count)}else for(let J=0;J<O.locationSize;J++)p(O.location+J);r.bindBuffer(r.ARRAY_BUFFER,ut);for(let J=0;J<O.locationSize;J++)_(O.location+J,G/O.locationSize,X,B,G*Z,G/O.locationSize*J*Z,rt)}}else if(L!==void 0){const B=L[V];if(B!==void 0)switch(B.length){case 2:r.vertexAttrib2fv(O.location,B);break;case 3:r.vertexAttrib3fv(O.location,B);break;case 4:r.vertexAttrib4fv(O.location,B);break;default:r.vertexAttrib1fv(O.location,B)}}}}x()}function w(){E();for(const M in n){const S=n[M];for(const k in S){const N=S[k];for(const z in N)h(N[z].object),delete N[z];delete S[k]}delete n[M]}}function T(M){if(n[M.id]===void 0)return;const S=n[M.id];for(const k in S){const N=S[k];for(const z in N)h(N[z].object),delete N[z];delete S[k]}delete n[M.id]}function R(M){for(const S in n){const k=n[S];if(k[M.id]===void 0)continue;const N=k[M.id];for(const z in N)h(N[z].object),delete N[z];delete k[M.id]}}function E(){D(),o=!0,s!==i&&(s=i,l(s.object))}function D(){i.geometry=null,i.program=null,i.wireframe=!1}return{setup:a,reset:E,resetDefaultState:D,dispose:w,releaseStatesOfGeometry:T,releaseStatesOfProgram:R,initAttributes:v,enableAttribute:p,disableUnusedAttributes:x}}function ig(r,t,e){let n;function i(l){n=l}function s(l,h){r.drawArrays(n,l,h),e.update(h,n,1)}function o(l,h,d){d!==0&&(r.drawArraysInstanced(n,l,h,d),e.update(h,n,d))}function a(l,h,d){if(d===0)return;t.get("WEBGL_multi_draw").multiDrawArraysWEBGL(n,l,0,h,0,d);let u=0;for(let m=0;m<d;m++)u+=h[m];e.update(u,n,1)}function c(l,h,d,f){if(d===0)return;const u=t.get("WEBGL_multi_draw");if(u===null)for(let m=0;m<l.length;m++)o(l[m],h[m],f[m]);else{u.multiDrawArraysInstancedWEBGL(n,l,0,h,0,f,0,d);let m=0;for(let v=0;v<d;v++)m+=h[v];for(let v=0;v<f.length;v++)e.update(m,n,f[v])}}this.setMode=i,this.render=s,this.renderInstances=o,this.renderMultiDraw=a,this.renderMultiDrawInstances=c}function sg(r,t,e,n){let i;function s(){if(i!==void 0)return i;if(t.has("EXT_texture_filter_anisotropic")===!0){const R=t.get("EXT_texture_filter_anisotropic");i=r.getParameter(R.MAX_TEXTURE_MAX_ANISOTROPY_EXT)}else i=0;return i}function o(R){return!(R!==Sn&&n.convert(R)!==r.getParameter(r.IMPLEMENTATION_COLOR_READ_FORMAT))}function a(R){const E=R===xi&&(t.has("EXT_color_buffer_half_float")||t.has("EXT_color_buffer_float"));return!(R!==ti&&n.convert(R)!==r.getParameter(r.IMPLEMENTATION_COLOR_READ_TYPE)&&R!==fn&&!E)}function c(R){if(R==="highp"){if(r.getShaderPrecisionFormat(r.VERTEX_SHADER,r.HIGH_FLOAT).precision>0&&r.getShaderPrecisionFormat(r.FRAGMENT_SHADER,r.HIGH_FLOAT).precision>0)return"highp";R="mediump"}return R==="mediump"&&r.getShaderPrecisionFormat(r.VERTEX_SHADER,r.MEDIUM_FLOAT).precision>0&&r.getShaderPrecisionFormat(r.FRAGMENT_SHADER,r.MEDIUM_FLOAT).precision>0?"mediump":"lowp"}let l=e.precision!==void 0?e.precision:"highp";const h=c(l);h!==l&&(console.warn("THREE.WebGLRenderer:",l,"not supported, using",h,"instead."),l=h);const d=e.logarithmicDepthBuffer===!0,f=e.reverseDepthBuffer===!0&&t.has("EXT_clip_control");if(f===!0){const R=t.get("EXT_clip_control");R.clipControlEXT(R.LOWER_LEFT_EXT,R.ZERO_TO_ONE_EXT)}const u=r.getParameter(r.MAX_TEXTURE_IMAGE_UNITS),m=r.getParameter(r.MAX_VERTEX_TEXTURE_IMAGE_UNITS),v=r.getParameter(r.MAX_TEXTURE_SIZE),p=r.getParameter(r.MAX_CUBE_MAP_TEXTURE_SIZE),g=r.getParameter(r.MAX_VERTEX_ATTRIBS),x=r.getParameter(r.MAX_VERTEX_UNIFORM_VECTORS),_=r.getParameter(r.MAX_VARYING_VECTORS),y=r.getParameter(r.MAX_FRAGMENT_UNIFORM_VECTORS),w=m>0,T=r.getParameter(r.MAX_SAMPLES);return{isWebGL2:!0,getMaxAnisotropy:s,getMaxPrecision:c,textureFormatReadable:o,textureTypeReadable:a,precision:l,logarithmicDepthBuffer:d,reverseDepthBuffer:f,maxTextures:u,maxVertexTextures:m,maxTextureSize:v,maxCubemapSize:p,maxAttributes:g,maxVertexUniforms:x,maxVaryings:_,maxFragmentUniforms:y,vertexTextures:w,maxSamples:T}}function rg(r){const t=this;let e=null,n=0,i=!1,s=!1;const o=new Qi,a=new Qt,c={value:null,needsUpdate:!1};this.uniform=c,this.numPlanes=0,this.numIntersection=0,this.init=function(d,f){const u=d.length!==0||f||n!==0||i;return i=f,n=d.length,u},this.beginShadows=function(){s=!0,h(null)},this.endShadows=function(){s=!1},this.setGlobalState=function(d,f){e=h(d,f,0)},this.setState=function(d,f,u){const m=d.clippingPlanes,v=d.clipIntersection,p=d.clipShadows,g=r.get(d);if(!i||m===null||m.length===0||s&&!p)s?h(null):l();else{const x=s?0:n,_=x*4;let y=g.clippingState||null;c.value=y,y=h(m,f,_,u);for(let w=0;w!==_;++w)y[w]=e[w];g.clippingState=y,this.numIntersection=v?this.numPlanes:0,this.numPlanes+=x}};function l(){c.value!==e&&(c.value=e,c.needsUpdate=n>0),t.numPlanes=n,t.numIntersection=0}function h(d,f,u,m){const v=d!==null?d.length:0;let p=null;if(v!==0){if(p=c.value,m!==!0||p===null){const g=u+v*4,x=f.matrixWorldInverse;a.getNormalMatrix(x),(p===null||p.length<g)&&(p=new Float32Array(g));for(let _=0,y=u;_!==v;++_,y+=4)o.copy(d[_]).applyMatrix4(x,a),o.normal.toArray(p,y),p[y+3]=o.constant}c.value=p,c.needsUpdate=!0}return t.numPlanes=v,t.numIntersection=0,p}}function og(r){let t=new WeakMap;function e(o,a){return a===wc?o.mapping=Os:a===Tc&&(o.mapping=Hs),o}function n(o){if(o&&o.isTexture){const a=o.mapping;if(a===wc||a===Tc)if(t.has(o)){const c=t.get(o).texture;return e(c,o.mapping)}else{const c=o.image;if(c&&c.height>0){const l=new _0(c.height);return l.fromEquirectangularTexture(r,o),t.set(o,l),o.addEventListener("dispose",i),e(l.texture,o.mapping)}else return null}}return o}function i(o){const a=o.target;a.removeEventListener("dispose",i);const c=t.get(a);c!==void 0&&(t.delete(a),c.dispose())}function s(){t=new WeakMap}return{get:n,dispose:s}}class wl extends g0{constructor(t=-1,e=1,n=1,i=-1,s=.1,o=2e3){super(),this.isOrthographicCamera=!0,this.type="OrthographicCamera",this.zoom=1,this.view=null,this.left=t,this.right=e,this.top=n,this.bottom=i,this.near=s,this.far=o,this.updateProjectionMatrix()}copy(t,e){return super.copy(t,e),this.left=t.left,this.right=t.right,this.top=t.top,this.bottom=t.bottom,this.near=t.near,this.far=t.far,this.zoom=t.zoom,this.view=t.view===null?null:Object.assign({},t.view),this}setViewOffset(t,e,n,i,s,o){this.view===null&&(this.view={enabled:!0,fullWidth:1,fullHeight:1,offsetX:0,offsetY:0,width:1,height:1}),this.view.enabled=!0,this.view.fullWidth=t,this.view.fullHeight=e,this.view.offsetX=n,this.view.offsetY=i,this.view.width=s,this.view.height=o,this.updateProjectionMatrix()}clearViewOffset(){this.view!==null&&(this.view.enabled=!1),this.updateProjectionMatrix()}updateProjectionMatrix(){const t=(this.right-this.left)/(2*this.zoom),e=(this.top-this.bottom)/(2*this.zoom),n=(this.right+this.left)/2,i=(this.top+this.bottom)/2;let s=n-t,o=n+t,a=i+e,c=i-e;if(this.view!==null&&this.view.enabled){const l=(this.right-this.left)/this.view.fullWidth/this.zoom,h=(this.top-this.bottom)/this.view.fullHeight/this.zoom;s+=l*this.view.offsetX,o=s+l*this.view.width,a-=h*this.view.offsetY,c=a-h*this.view.height}this.projectionMatrix.makeOrthographic(s,o,a,c,this.near,this.far,this.coordinateSystem),this.projectionMatrixInverse.copy(this.projectionMatrix).invert()}toJSON(t){const e=super.toJSON(t);return e.object.zoom=this.zoom,e.object.left=this.left,e.object.right=this.right,e.object.top=this.top,e.object.bottom=this.bottom,e.object.near=this.near,e.object.far=this.far,this.view!==null&&(e.object.view=Object.assign({},this.view)),e}}const Ps=4,Eh=[.125,.215,.35,.446,.526,.582],ns=20,Ua=new wl,Ah=new dt;let za=null,Fa=0,Ba=0,Oa=!1;const ts=(1+Math.sqrt(5))/2,Ms=1/ts,Rh=[new A(-ts,Ms,0),new A(ts,Ms,0),new A(-Ms,0,ts),new A(Ms,0,ts),new A(0,ts,-Ms),new A(0,ts,Ms),new A(-1,1,-1),new A(1,1,-1),new A(-1,1,1),new A(1,1,1)];class tl{constructor(t){this._renderer=t,this._pingPongRenderTarget=null,this._lodMax=0,this._cubeSize=0,this._lodPlanes=[],this._sizeLods=[],this._sigmas=[],this._blurMaterial=null,this._cubemapMaterial=null,this._equirectMaterial=null,this._compileMaterial(this._blurMaterial)}fromScene(t,e=0,n=.1,i=100){za=this._renderer.getRenderTarget(),Fa=this._renderer.getActiveCubeFace(),Ba=this._renderer.getActiveMipmapLevel(),Oa=this._renderer.xr.enabled,this._renderer.xr.enabled=!1,this._setSize(256);const s=this._allocateTargets();return s.depthBuffer=!0,this._sceneToCubeUV(t,n,i,s),e>0&&this._blur(s,0,0,e),this._applyPMREM(s),this._cleanup(s),s}fromEquirectangular(t,e=null){return this._fromTexture(t,e)}fromCubemap(t,e=null){return this._fromTexture(t,e)}compileCubemapShader(){this._cubemapMaterial===null&&(this._cubemapMaterial=Lh(),this._compileMaterial(this._cubemapMaterial))}compileEquirectangularShader(){this._equirectMaterial===null&&(this._equirectMaterial=Ph(),this._compileMaterial(this._equirectMaterial))}dispose(){this._dispose(),this._cubemapMaterial!==null&&this._cubemapMaterial.dispose(),this._equirectMaterial!==null&&this._equirectMaterial.dispose()}_setSize(t){this._lodMax=Math.floor(Math.log2(t)),this._cubeSize=Math.pow(2,this._lodMax)}_dispose(){this._blurMaterial!==null&&this._blurMaterial.dispose(),this._pingPongRenderTarget!==null&&this._pingPongRenderTarget.dispose();for(let t=0;t<this._lodPlanes.length;t++)this._lodPlanes[t].dispose()}_cleanup(t){this._renderer.setRenderTarget(za,Fa,Ba),this._renderer.xr.enabled=Oa,t.scissorTest=!1,io(t,0,0,t.width,t.height)}_fromTexture(t,e){t.mapping===Os||t.mapping===Hs?this._setSize(t.image.length===0?16:t.image[0].width||t.image[0].image.width):this._setSize(t.image.width/4),za=this._renderer.getRenderTarget(),Fa=this._renderer.getActiveCubeFace(),Ba=this._renderer.getActiveMipmapLevel(),Oa=this._renderer.xr.enabled,this._renderer.xr.enabled=!1;const n=e||this._allocateTargets();return this._textureToCubeUV(t,n),this._applyPMREM(n),this._cleanup(n),n}_allocateTargets(){const t=3*Math.max(this._cubeSize,112),e=4*this._cubeSize,n={magFilter:bn,minFilter:bn,generateMipmaps:!1,type:xi,format:Sn,colorSpace:Hi,depthBuffer:!1},i=Ch(t,e,n);if(this._pingPongRenderTarget===null||this._pingPongRenderTarget.width!==t||this._pingPongRenderTarget.height!==e){this._pingPongRenderTarget!==null&&this._dispose(),this._pingPongRenderTarget=Ch(t,e,n);const{_lodMax:s}=this;({sizeLods:this._sizeLods,lodPlanes:this._lodPlanes,sigmas:this._sigmas}=ag(s)),this._blurMaterial=cg(s,t,e)}return i}_compileMaterial(t){const e=new Ht(this._lodPlanes[0],t);this._renderer.compile(e,Ua)}_sceneToCubeUV(t,e,n,i){const a=new Cn(90,1,e,n),c=[1,-1,1,1,1,1],l=[1,1,1,-1,-1,-1],h=this._renderer,d=h.autoClear,f=h.toneMapping;h.getClearColor(Ah),h.toneMapping=Yn,h.autoClear=!1;const u=new ea({name:"PMREM.Background",side:sn,depthWrite:!1,depthTest:!1}),m=new Ht(new Vn,u);let v=!1;const p=t.background;p?p.isColor&&(u.color.copy(p),t.background=null,v=!0):(u.color.copy(Ah),v=!0);for(let g=0;g<6;g++){const x=g%3;x===0?(a.up.set(0,c[g],0),a.lookAt(l[g],0,0)):x===1?(a.up.set(0,0,c[g]),a.lookAt(0,l[g],0)):(a.up.set(0,c[g],0),a.lookAt(0,0,l[g]));const _=this._cubeSize;io(i,x*_,g>2?_:0,_,_),h.setRenderTarget(i),v&&h.render(m,a),h.render(t,a)}m.geometry.dispose(),m.material.dispose(),h.toneMapping=f,h.autoClear=d,t.background=p}_textureToCubeUV(t,e){const n=this._renderer,i=t.mapping===Os||t.mapping===Hs;i?(this._cubemapMaterial===null&&(this._cubemapMaterial=Lh()),this._cubemapMaterial.uniforms.flipEnvMap.value=t.isRenderTargetTexture===!1?-1:1):this._equirectMaterial===null&&(this._equirectMaterial=Ph());const s=i?this._cubemapMaterial:this._equirectMaterial,o=new Ht(this._lodPlanes[0],s),a=s.uniforms;a.envMap.value=t;const c=this._cubeSize;io(e,0,0,3*c,2*c),n.setRenderTarget(e),n.render(o,Ua)}_applyPMREM(t){const e=this._renderer,n=e.autoClear;e.autoClear=!1;const i=this._lodPlanes.length;for(let s=1;s<i;s++){const o=Math.sqrt(this._sigmas[s]*this._sigmas[s]-this._sigmas[s-1]*this._sigmas[s-1]),a=Rh[(i-s-1)%Rh.length];this._blur(t,s-1,s,o,a)}e.autoClear=n}_blur(t,e,n,i,s){const o=this._pingPongRenderTarget;this._halfBlur(t,o,e,n,i,"latitudinal",s),this._halfBlur(o,t,n,n,i,"longitudinal",s)}_halfBlur(t,e,n,i,s,o,a){const c=this._renderer,l=this._blurMaterial;o!=="latitudinal"&&o!=="longitudinal"&&console.error("blur direction must be either latitudinal or longitudinal!");const h=3,d=new Ht(this._lodPlanes[i],l),f=l.uniforms,u=this._sizeLods[n]-1,m=isFinite(s)?Math.PI/(2*u):2*Math.PI/(2*ns-1),v=s/m,p=isFinite(s)?1+Math.floor(h*v):ns;p>ns&&console.warn(`sigmaRadians, ${s}, is too large and will clip, as it requested ${p} samples when the maximum is set to ${ns}`);const g=[];let x=0;for(let R=0;R<ns;++R){const E=R/v,D=Math.exp(-E*E/2);g.push(D),R===0?x+=D:R<p&&(x+=2*D)}for(let R=0;R<g.length;R++)g[R]=g[R]/x;f.envMap.value=t.texture,f.samples.value=p,f.weights.value=g,f.latitudinal.value=o==="latitudinal",a&&(f.poleAxis.value=a);const{_lodMax:_}=this;f.dTheta.value=m,f.mipInt.value=_-n;const y=this._sizeLods[i],w=3*y*(i>_-Ps?i-_+Ps:0),T=4*(this._cubeSize-y);io(e,w,T,3*y,2*y),c.setRenderTarget(e),c.render(d,Ua)}}function ag(r){const t=[],e=[],n=[];let i=r;const s=r-Ps+1+Eh.length;for(let o=0;o<s;o++){const a=Math.pow(2,i);e.push(a);let c=1/a;o>r-Ps?c=Eh[o-r+Ps-1]:o===0&&(c=0),n.push(c);const l=1/(a-2),h=-l,d=1+l,f=[h,h,d,h,d,d,h,h,d,d,h,d],u=6,m=6,v=3,p=2,g=1,x=new Float32Array(v*m*u),_=new Float32Array(p*m*u),y=new Float32Array(g*m*u);for(let T=0;T<u;T++){const R=T%3*2/3-1,E=T>2?0:-1,D=[R,E,0,R+2/3,E,0,R+2/3,E+1,0,R,E,0,R+2/3,E+1,0,R,E+1,0];x.set(D,v*m*T),_.set(f,p*m*T);const M=[T,T,T,T,T,T];y.set(M,g*m*T)}const w=new ge;w.setAttribute("position",new te(x,v)),w.setAttribute("uv",new te(_,p)),w.setAttribute("faceIndex",new te(y,g)),t.push(w),i>Ps&&i--}return{lodPlanes:t,sizeLods:e,sigmas:n}}function Ch(r,t,e){const n=new ei(r,t,e);return n.texture.mapping=Jo,n.texture.name="PMREM.cubeUv",n.scissorTest=!0,n}function io(r,t,e,n,i){r.viewport.set(t,e,n,i),r.scissor.set(t,e,n,i)}function cg(r,t,e){const n=new Float32Array(ns),i=new A(0,1,0);return new Ye({name:"SphericalGaussianBlur",defines:{n:ns,CUBEUV_TEXEL_WIDTH:1/t,CUBEUV_TEXEL_HEIGHT:1/e,CUBEUV_MAX_MIP:`${r}.0`},uniforms:{envMap:{value:null},samples:{value:1},weights:{value:n},latitudinal:{value:!1},dTheta:{value:0},mipInt:{value:0},poleAxis:{value:i}},vertexShader:Tl(),fragmentShader:`

			precision mediump float;
			precision mediump int;

			varying vec3 vOutputDirection;

			uniform sampler2D envMap;
			uniform int samples;
			uniform float weights[ n ];
			uniform bool latitudinal;
			uniform float dTheta;
			uniform float mipInt;
			uniform vec3 poleAxis;

			#define ENVMAP_TYPE_CUBE_UV
			#include <cube_uv_reflection_fragment>

			vec3 getSample( float theta, vec3 axis ) {

				float cosTheta = cos( theta );
				// Rodrigues' axis-angle rotation
				vec3 sampleDirection = vOutputDirection * cosTheta
					+ cross( axis, vOutputDirection ) * sin( theta )
					+ axis * dot( axis, vOutputDirection ) * ( 1.0 - cosTheta );

				return bilinearCubeUV( envMap, sampleDirection, mipInt );

			}

			void main() {

				vec3 axis = latitudinal ? poleAxis : cross( poleAxis, vOutputDirection );

				if ( all( equal( axis, vec3( 0.0 ) ) ) ) {

					axis = vec3( vOutputDirection.z, 0.0, - vOutputDirection.x );

				}

				axis = normalize( axis );

				gl_FragColor = vec4( 0.0, 0.0, 0.0, 1.0 );
				gl_FragColor.rgb += weights[ 0 ] * getSample( 0.0, axis );

				for ( int i = 1; i < n; i++ ) {

					if ( i >= samples ) {

						break;

					}

					float theta = dTheta * float( i );
					gl_FragColor.rgb += weights[ i ] * getSample( -1.0 * theta, axis );
					gl_FragColor.rgb += weights[ i ] * getSample( theta, axis );

				}

			}
		`,blending:jn,depthTest:!1,depthWrite:!1})}function Ph(){return new Ye({name:"EquirectangularToCubeUV",uniforms:{envMap:{value:null}},vertexShader:Tl(),fragmentShader:`

			precision mediump float;
			precision mediump int;

			varying vec3 vOutputDirection;

			uniform sampler2D envMap;

			#include <common>

			void main() {

				vec3 outputDirection = normalize( vOutputDirection );
				vec2 uv = equirectUv( outputDirection );

				gl_FragColor = vec4( texture2D ( envMap, uv ).rgb, 1.0 );

			}
		`,blending:jn,depthTest:!1,depthWrite:!1})}function Lh(){return new Ye({name:"CubemapToCubeUV",uniforms:{envMap:{value:null},flipEnvMap:{value:-1}},vertexShader:Tl(),fragmentShader:`

			precision mediump float;
			precision mediump int;

			uniform float flipEnvMap;

			varying vec3 vOutputDirection;

			uniform samplerCube envMap;

			void main() {

				gl_FragColor = textureCube( envMap, vec3( flipEnvMap * vOutputDirection.x, vOutputDirection.yz ) );

			}
		`,blending:jn,depthTest:!1,depthWrite:!1})}function Tl(){return`

		precision mediump float;
		precision mediump int;

		attribute float faceIndex;

		varying vec3 vOutputDirection;

		// RH coordinate system; PMREM face-indexing convention
		vec3 getDirection( vec2 uv, float face ) {

			uv = 2.0 * uv - 1.0;

			vec3 direction = vec3( uv, 1.0 );

			if ( face == 0.0 ) {

				direction = direction.zyx; // ( 1, v, u ) pos x

			} else if ( face == 1.0 ) {

				direction = direction.xzy;
				direction.xz *= -1.0; // ( -u, 1, -v ) pos y

			} else if ( face == 2.0 ) {

				direction.x *= -1.0; // ( -u, v, 1 ) pos z

			} else if ( face == 3.0 ) {

				direction = direction.zyx;
				direction.xz *= -1.0; // ( -1, v, -u ) neg x

			} else if ( face == 4.0 ) {

				direction = direction.xzy;
				direction.xy *= -1.0; // ( -u, -1, v ) neg y

			} else if ( face == 5.0 ) {

				direction.z *= -1.0; // ( u, v, -1 ) neg z

			}

			return direction;

		}

		void main() {

			vOutputDirection = getDirection( uv, faceIndex );
			gl_Position = vec4( position, 1.0 );

		}
	`}function lg(r){let t=new WeakMap,e=null;function n(a){if(a&&a.isTexture){const c=a.mapping,l=c===wc||c===Tc,h=c===Os||c===Hs;if(l||h){let d=t.get(a);const f=d!==void 0?d.texture.pmremVersion:0;if(a.isRenderTargetTexture&&a.pmremVersion!==f)return e===null&&(e=new tl(r)),d=l?e.fromEquirectangular(a,d):e.fromCubemap(a,d),d.texture.pmremVersion=a.pmremVersion,t.set(a,d),d.texture;if(d!==void 0)return d.texture;{const u=a.image;return l&&u&&u.height>0||h&&u&&i(u)?(e===null&&(e=new tl(r)),d=l?e.fromEquirectangular(a):e.fromCubemap(a),d.texture.pmremVersion=a.pmremVersion,t.set(a,d),a.addEventListener("dispose",s),d.texture):null}}}return a}function i(a){let c=0;const l=6;for(let h=0;h<l;h++)a[h]!==void 0&&c++;return c===l}function s(a){const c=a.target;c.removeEventListener("dispose",s);const l=t.get(c);l!==void 0&&(t.delete(c),l.dispose())}function o(){t=new WeakMap,e!==null&&(e.dispose(),e=null)}return{get:n,dispose:o}}function hg(r){const t={};function e(n){if(t[n]!==void 0)return t[n];let i;switch(n){case"WEBGL_depth_texture":i=r.getExtension("WEBGL_depth_texture")||r.getExtension("MOZ_WEBGL_depth_texture")||r.getExtension("WEBKIT_WEBGL_depth_texture");break;case"EXT_texture_filter_anisotropic":i=r.getExtension("EXT_texture_filter_anisotropic")||r.getExtension("MOZ_EXT_texture_filter_anisotropic")||r.getExtension("WEBKIT_EXT_texture_filter_anisotropic");break;case"WEBGL_compressed_texture_s3tc":i=r.getExtension("WEBGL_compressed_texture_s3tc")||r.getExtension("MOZ_WEBGL_compressed_texture_s3tc")||r.getExtension("WEBKIT_WEBGL_compressed_texture_s3tc");break;case"WEBGL_compressed_texture_pvrtc":i=r.getExtension("WEBGL_compressed_texture_pvrtc")||r.getExtension("WEBKIT_WEBGL_compressed_texture_pvrtc");break;default:i=r.getExtension(n)}return t[n]=i,i}return{has:function(n){return e(n)!==null},init:function(){e("EXT_color_buffer_float"),e("WEBGL_clip_cull_distance"),e("OES_texture_float_linear"),e("EXT_color_buffer_half_float"),e("WEBGL_multisampled_render_to_texture"),e("WEBGL_render_shared_exponent")},get:function(n){const i=e(n);return i===null&&ko("THREE.WebGLRenderer: "+n+" extension not supported."),i}}}function ug(r,t,e,n){const i={},s=new WeakMap;function o(d){const f=d.target;f.index!==null&&t.remove(f.index);for(const m in f.attributes)t.remove(f.attributes[m]);for(const m in f.morphAttributes){const v=f.morphAttributes[m];for(let p=0,g=v.length;p<g;p++)t.remove(v[p])}f.removeEventListener("dispose",o),delete i[f.id];const u=s.get(f);u&&(t.remove(u),s.delete(f)),n.releaseStatesOfGeometry(f),f.isInstancedBufferGeometry===!0&&delete f._maxInstanceCount,e.memory.geometries--}function a(d,f){return i[f.id]===!0||(f.addEventListener("dispose",o),i[f.id]=!0,e.memory.geometries++),f}function c(d){const f=d.attributes;for(const m in f)t.update(f[m],r.ARRAY_BUFFER);const u=d.morphAttributes;for(const m in u){const v=u[m];for(let p=0,g=v.length;p<g;p++)t.update(v[p],r.ARRAY_BUFFER)}}function l(d){const f=[],u=d.index,m=d.attributes.position;let v=0;if(u!==null){const x=u.array;v=u.version;for(let _=0,y=x.length;_<y;_+=3){const w=x[_+0],T=x[_+1],R=x[_+2];f.push(w,T,T,R,R,w)}}else if(m!==void 0){const x=m.array;v=m.version;for(let _=0,y=x.length/3-1;_<y;_+=3){const w=_+0,T=_+1,R=_+2;f.push(w,T,T,R,R,w)}}else return;const p=new(c0(f)?f0:bl)(f,1);p.version=v;const g=s.get(d);g&&t.remove(g),s.set(d,p)}function h(d){const f=s.get(d);if(f){const u=d.index;u!==null&&f.version<u.version&&l(d)}else l(d);return s.get(d)}return{get:a,update:c,getWireframeAttribute:h}}function dg(r,t,e){let n;function i(f){n=f}let s,o;function a(f){s=f.type,o=f.bytesPerElement}function c(f,u){r.drawElements(n,u,s,f*o),e.update(u,n,1)}function l(f,u,m){m!==0&&(r.drawElementsInstanced(n,u,s,f*o,m),e.update(u,n,m))}function h(f,u,m){if(m===0)return;t.get("WEBGL_multi_draw").multiDrawElementsWEBGL(n,u,0,s,f,0,m);let p=0;for(let g=0;g<m;g++)p+=u[g];e.update(p,n,1)}function d(f,u,m,v){if(m===0)return;const p=t.get("WEBGL_multi_draw");if(p===null)for(let g=0;g<f.length;g++)l(f[g]/o,u[g],v[g]);else{p.multiDrawElementsInstancedWEBGL(n,u,0,s,f,0,v,0,m);let g=0;for(let x=0;x<m;x++)g+=u[x];for(let x=0;x<v.length;x++)e.update(g,n,v[x])}}this.setMode=i,this.setIndex=a,this.render=c,this.renderInstances=l,this.renderMultiDraw=h,this.renderMultiDrawInstances=d}function fg(r){const t={geometries:0,textures:0},e={frame:0,calls:0,triangles:0,points:0,lines:0};function n(s,o,a){switch(e.calls++,o){case r.TRIANGLES:e.triangles+=a*(s/3);break;case r.LINES:e.lines+=a*(s/2);break;case r.LINE_STRIP:e.lines+=a*(s-1);break;case r.LINE_LOOP:e.lines+=a*s;break;case r.POINTS:e.points+=a*s;break;default:console.error("THREE.WebGLInfo: Unknown draw mode:",o);break}}function i(){e.calls=0,e.triangles=0,e.points=0,e.lines=0}return{memory:t,render:e,programs:null,autoReset:!0,reset:i,update:n}}function pg(r,t,e){const n=new WeakMap,i=new we;function s(o,a,c){const l=o.morphTargetInfluences,h=a.morphAttributes.position||a.morphAttributes.normal||a.morphAttributes.color,d=h!==void 0?h.length:0;let f=n.get(a);if(f===void 0||f.count!==d){let D=function(){R.dispose(),n.delete(a),a.removeEventListener("dispose",D)};f!==void 0&&f.texture.dispose();const u=a.morphAttributes.position!==void 0,m=a.morphAttributes.normal!==void 0,v=a.morphAttributes.color!==void 0,p=a.morphAttributes.position||[],g=a.morphAttributes.normal||[],x=a.morphAttributes.color||[];let _=0;u===!0&&(_=1),m===!0&&(_=2),v===!0&&(_=3);let y=a.attributes.position.count*_,w=1;y>t.maxTextureSize&&(w=Math.ceil(y/t.maxTextureSize),y=t.maxTextureSize);const T=new Float32Array(y*w*4*d),R=new h0(T,y,w,d);R.type=fn,R.needsUpdate=!0;const E=_*4;for(let M=0;M<d;M++){const S=p[M],k=g[M],N=x[M],z=y*w*4*M;for(let H=0;H<S.count;H++){const L=H*E;u===!0&&(i.fromBufferAttribute(S,H),T[z+L+0]=i.x,T[z+L+1]=i.y,T[z+L+2]=i.z,T[z+L+3]=0),m===!0&&(i.fromBufferAttribute(k,H),T[z+L+4]=i.x,T[z+L+5]=i.y,T[z+L+6]=i.z,T[z+L+7]=0),v===!0&&(i.fromBufferAttribute(N,H),T[z+L+8]=i.x,T[z+L+9]=i.y,T[z+L+10]=i.z,T[z+L+11]=N.itemSize===4?i.w:1)}}f={count:d,texture:R,size:new ct(y,w)},n.set(a,f),a.addEventListener("dispose",D)}if(o.isInstancedMesh===!0&&o.morphTexture!==null)c.getUniforms().setValue(r,"morphTexture",o.morphTexture,e);else{let u=0;for(let v=0;v<l.length;v++)u+=l[v];const m=a.morphTargetsRelative?1:1-u;c.getUniforms().setValue(r,"morphTargetBaseInfluence",m),c.getUniforms().setValue(r,"morphTargetInfluences",l)}c.getUniforms().setValue(r,"morphTargetsTexture",f.texture,e),c.getUniforms().setValue(r,"morphTargetsTextureSize",f.size)}return{update:s}}function mg(r,t,e,n){let i=new WeakMap;function s(c){const l=n.render.frame,h=c.geometry,d=t.get(c,h);if(i.get(d)!==l&&(t.update(d),i.set(d,l)),c.isInstancedMesh&&(c.hasEventListener("dispose",a)===!1&&c.addEventListener("dispose",a),i.get(c)!==l&&(e.update(c.instanceMatrix,r.ARRAY_BUFFER),c.instanceColor!==null&&e.update(c.instanceColor,r.ARRAY_BUFFER),i.set(c,l))),c.isSkinnedMesh){const f=c.skeleton;i.get(f)!==l&&(f.update(),i.set(f,l))}return d}function o(){i=new WeakMap}function a(c){const l=c.target;l.removeEventListener("dispose",a),e.remove(l.instanceMatrix),l.instanceColor!==null&&e.remove(l.instanceColor)}return{update:s,dispose:o}}class Go extends Ke{constructor(t,e,n,i,s,o,a,c,l,h=zi){if(h!==zi&&h!==Gs)throw new Error("DepthTexture format must be either THREE.DepthFormat or THREE.DepthStencilFormat");n===void 0&&h===zi&&(n=rs),n===void 0&&h===Gs&&(n=Vs),super(null,i,s,o,a,c,h,n,l),this.isDepthTexture=!0,this.image={width:t,height:e},this.magFilter=a!==void 0?a:en,this.minFilter=c!==void 0?c:en,this.flipY=!1,this.generateMipmaps=!1,this.compareFunction=null}copy(t){return super.copy(t),this.compareFunction=t.compareFunction,this}toJSON(t){const e=super.toJSON(t);return this.compareFunction!==null&&(e.compareFunction=this.compareFunction),e}}const M0=new Ke,kh=new Go(1,1),b0=new h0,S0=new sf,w0=new x0,Dh=[],Ih=[],Nh=new Float32Array(16),Uh=new Float32Array(9),zh=new Float32Array(4);function Js(r,t,e){const n=r[0];if(n<=0||n>0)return r;const i=t*e;let s=Dh[i];if(s===void 0&&(s=new Float32Array(i),Dh[i]=s),t!==0){n.toArray(s,0);for(let o=1,a=0;o!==t;++o)a+=e,r[o].toArray(s,a)}return s}function Ge(r,t){if(r.length!==t.length)return!1;for(let e=0,n=r.length;e<n;e++)if(r[e]!==t[e])return!1;return!0}function We(r,t){for(let e=0,n=t.length;e<n;e++)r[e]=t[e]}function na(r,t){let e=Ih[t];e===void 0&&(e=new Int32Array(t),Ih[t]=e);for(let n=0;n!==t;++n)e[n]=r.allocateTextureUnit();return e}function gg(r,t){const e=this.cache;e[0]!==t&&(r.uniform1f(this.addr,t),e[0]=t)}function vg(r,t){const e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y)&&(r.uniform2f(this.addr,t.x,t.y),e[0]=t.x,e[1]=t.y);else{if(Ge(e,t))return;r.uniform2fv(this.addr,t),We(e,t)}}function xg(r,t){const e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y||e[2]!==t.z)&&(r.uniform3f(this.addr,t.x,t.y,t.z),e[0]=t.x,e[1]=t.y,e[2]=t.z);else if(t.r!==void 0)(e[0]!==t.r||e[1]!==t.g||e[2]!==t.b)&&(r.uniform3f(this.addr,t.r,t.g,t.b),e[0]=t.r,e[1]=t.g,e[2]=t.b);else{if(Ge(e,t))return;r.uniform3fv(this.addr,t),We(e,t)}}function _g(r,t){const e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y||e[2]!==t.z||e[3]!==t.w)&&(r.uniform4f(this.addr,t.x,t.y,t.z,t.w),e[0]=t.x,e[1]=t.y,e[2]=t.z,e[3]=t.w);else{if(Ge(e,t))return;r.uniform4fv(this.addr,t),We(e,t)}}function yg(r,t){const e=this.cache,n=t.elements;if(n===void 0){if(Ge(e,t))return;r.uniformMatrix2fv(this.addr,!1,t),We(e,t)}else{if(Ge(e,n))return;zh.set(n),r.uniformMatrix2fv(this.addr,!1,zh),We(e,n)}}function Mg(r,t){const e=this.cache,n=t.elements;if(n===void 0){if(Ge(e,t))return;r.uniformMatrix3fv(this.addr,!1,t),We(e,t)}else{if(Ge(e,n))return;Uh.set(n),r.uniformMatrix3fv(this.addr,!1,Uh),We(e,n)}}function bg(r,t){const e=this.cache,n=t.elements;if(n===void 0){if(Ge(e,t))return;r.uniformMatrix4fv(this.addr,!1,t),We(e,t)}else{if(Ge(e,n))return;Nh.set(n),r.uniformMatrix4fv(this.addr,!1,Nh),We(e,n)}}function Sg(r,t){const e=this.cache;e[0]!==t&&(r.uniform1i(this.addr,t),e[0]=t)}function wg(r,t){const e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y)&&(r.uniform2i(this.addr,t.x,t.y),e[0]=t.x,e[1]=t.y);else{if(Ge(e,t))return;r.uniform2iv(this.addr,t),We(e,t)}}function Tg(r,t){const e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y||e[2]!==t.z)&&(r.uniform3i(this.addr,t.x,t.y,t.z),e[0]=t.x,e[1]=t.y,e[2]=t.z);else{if(Ge(e,t))return;r.uniform3iv(this.addr,t),We(e,t)}}function Eg(r,t){const e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y||e[2]!==t.z||e[3]!==t.w)&&(r.uniform4i(this.addr,t.x,t.y,t.z,t.w),e[0]=t.x,e[1]=t.y,e[2]=t.z,e[3]=t.w);else{if(Ge(e,t))return;r.uniform4iv(this.addr,t),We(e,t)}}function Ag(r,t){const e=this.cache;e[0]!==t&&(r.uniform1ui(this.addr,t),e[0]=t)}function Rg(r,t){const e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y)&&(r.uniform2ui(this.addr,t.x,t.y),e[0]=t.x,e[1]=t.y);else{if(Ge(e,t))return;r.uniform2uiv(this.addr,t),We(e,t)}}function Cg(r,t){const e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y||e[2]!==t.z)&&(r.uniform3ui(this.addr,t.x,t.y,t.z),e[0]=t.x,e[1]=t.y,e[2]=t.z);else{if(Ge(e,t))return;r.uniform3uiv(this.addr,t),We(e,t)}}function Pg(r,t){const e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y||e[2]!==t.z||e[3]!==t.w)&&(r.uniform4ui(this.addr,t.x,t.y,t.z,t.w),e[0]=t.x,e[1]=t.y,e[2]=t.z,e[3]=t.w);else{if(Ge(e,t))return;r.uniform4uiv(this.addr,t),We(e,t)}}function Lg(r,t,e){const n=this.cache,i=e.allocateTextureUnit();n[0]!==i&&(r.uniform1i(this.addr,i),n[0]=i);let s;this.type===r.SAMPLER_2D_SHADOW?(kh.compareFunction=a0,s=kh):s=M0,e.setTexture2D(t||s,i)}function kg(r,t,e){const n=this.cache,i=e.allocateTextureUnit();n[0]!==i&&(r.uniform1i(this.addr,i),n[0]=i),e.setTexture3D(t||S0,i)}function Dg(r,t,e){const n=this.cache,i=e.allocateTextureUnit();n[0]!==i&&(r.uniform1i(this.addr,i),n[0]=i),e.setTextureCube(t||w0,i)}function Ig(r,t,e){const n=this.cache,i=e.allocateTextureUnit();n[0]!==i&&(r.uniform1i(this.addr,i),n[0]=i),e.setTexture2DArray(t||b0,i)}function Ng(r){switch(r){case 5126:return gg;case 35664:return vg;case 35665:return xg;case 35666:return _g;case 35674:return yg;case 35675:return Mg;case 35676:return bg;case 5124:case 35670:return Sg;case 35667:case 35671:return wg;case 35668:case 35672:return Tg;case 35669:case 35673:return Eg;case 5125:return Ag;case 36294:return Rg;case 36295:return Cg;case 36296:return Pg;case 35678:case 36198:case 36298:case 36306:case 35682:return Lg;case 35679:case 36299:case 36307:return kg;case 35680:case 36300:case 36308:case 36293:return Dg;case 36289:case 36303:case 36311:case 36292:return Ig}}function Ug(r,t){r.uniform1fv(this.addr,t)}function zg(r,t){const e=Js(t,this.size,2);r.uniform2fv(this.addr,e)}function Fg(r,t){const e=Js(t,this.size,3);r.uniform3fv(this.addr,e)}function Bg(r,t){const e=Js(t,this.size,4);r.uniform4fv(this.addr,e)}function Og(r,t){const e=Js(t,this.size,4);r.uniformMatrix2fv(this.addr,!1,e)}function Hg(r,t){const e=Js(t,this.size,9);r.uniformMatrix3fv(this.addr,!1,e)}function Vg(r,t){const e=Js(t,this.size,16);r.uniformMatrix4fv(this.addr,!1,e)}function Gg(r,t){r.uniform1iv(this.addr,t)}function Wg(r,t){r.uniform2iv(this.addr,t)}function qg(r,t){r.uniform3iv(this.addr,t)}function Xg(r,t){r.uniform4iv(this.addr,t)}function jg(r,t){r.uniform1uiv(this.addr,t)}function Yg(r,t){r.uniform2uiv(this.addr,t)}function $g(r,t){r.uniform3uiv(this.addr,t)}function Kg(r,t){r.uniform4uiv(this.addr,t)}function Zg(r,t,e){const n=this.cache,i=t.length,s=na(e,i);Ge(n,s)||(r.uniform1iv(this.addr,s),We(n,s));for(let o=0;o!==i;++o)e.setTexture2D(t[o]||M0,s[o])}function Jg(r,t,e){const n=this.cache,i=t.length,s=na(e,i);Ge(n,s)||(r.uniform1iv(this.addr,s),We(n,s));for(let o=0;o!==i;++o)e.setTexture3D(t[o]||S0,s[o])}function Qg(r,t,e){const n=this.cache,i=t.length,s=na(e,i);Ge(n,s)||(r.uniform1iv(this.addr,s),We(n,s));for(let o=0;o!==i;++o)e.setTextureCube(t[o]||w0,s[o])}function t1(r,t,e){const n=this.cache,i=t.length,s=na(e,i);Ge(n,s)||(r.uniform1iv(this.addr,s),We(n,s));for(let o=0;o!==i;++o)e.setTexture2DArray(t[o]||b0,s[o])}function e1(r){switch(r){case 5126:return Ug;case 35664:return zg;case 35665:return Fg;case 35666:return Bg;case 35674:return Og;case 35675:return Hg;case 35676:return Vg;case 5124:case 35670:return Gg;case 35667:case 35671:return Wg;case 35668:case 35672:return qg;case 35669:case 35673:return Xg;case 5125:return jg;case 36294:return Yg;case 36295:return $g;case 36296:return Kg;case 35678:case 36198:case 36298:case 36306:case 35682:return Zg;case 35679:case 36299:case 36307:return Jg;case 35680:case 36300:case 36308:case 36293:return Qg;case 36289:case 36303:case 36311:case 36292:return t1}}class n1{constructor(t,e,n){this.id=t,this.addr=n,this.cache=[],this.type=e.type,this.setValue=Ng(e.type)}}class i1{constructor(t,e,n){this.id=t,this.addr=n,this.cache=[],this.type=e.type,this.size=e.size,this.setValue=e1(e.type)}}class s1{constructor(t){this.id=t,this.seq=[],this.map={}}setValue(t,e,n){const i=this.seq;for(let s=0,o=i.length;s!==o;++s){const a=i[s];a.setValue(t,e[a.id],n)}}}const Ha=/(\w+)(\])?(\[|\.)?/g;function Fh(r,t){r.seq.push(t),r.map[t.id]=t}function r1(r,t,e){const n=r.name,i=n.length;for(Ha.lastIndex=0;;){const s=Ha.exec(n),o=Ha.lastIndex;let a=s[1];const c=s[2]==="]",l=s[3];if(c&&(a=a|0),l===void 0||l==="["&&o+2===i){Fh(e,l===void 0?new n1(a,r,t):new i1(a,r,t));break}else{let d=e.map[a];d===void 0&&(d=new s1(a),Fh(e,d)),e=d}}}class Do{constructor(t,e){this.seq=[],this.map={};const n=t.getProgramParameter(e,t.ACTIVE_UNIFORMS);for(let i=0;i<n;++i){const s=t.getActiveUniform(e,i),o=t.getUniformLocation(e,s.name);r1(s,o,this)}}setValue(t,e,n,i){const s=this.map[e];s!==void 0&&s.setValue(t,n,i)}setOptional(t,e,n){const i=e[n];i!==void 0&&this.setValue(t,n,i)}static upload(t,e,n,i){for(let s=0,o=e.length;s!==o;++s){const a=e[s],c=n[a.id];c.needsUpdate!==!1&&a.setValue(t,c.value,i)}}static seqWithValue(t,e){const n=[];for(let i=0,s=t.length;i!==s;++i){const o=t[i];o.id in e&&n.push(o)}return n}}function Bh(r,t,e){const n=r.createShader(t);return r.shaderSource(n,e),r.compileShader(n),n}const o1=37297;let a1=0;function c1(r,t){const e=r.split(`
`),n=[],i=Math.max(t-6,0),s=Math.min(t+6,e.length);for(let o=i;o<s;o++){const a=o+1;n.push(`${a===t?">":" "} ${a}: ${e[o]}`)}return n.join(`
`)}function l1(r){const t=me.getPrimaries(me.workingColorSpace),e=me.getPrimaries(r);let n;switch(t===e?n="":t===Ho&&e===Oo?n="LinearDisplayP3ToLinearSRGB":t===Oo&&e===Ho&&(n="LinearSRGBToLinearDisplayP3"),r){case Hi:case Qo:return[n,"LinearTransferOETF"];case Mn:case yl:return[n,"sRGBTransferOETF"];default:return console.warn("THREE.WebGLProgram: Unsupported color space:",r),[n,"LinearTransferOETF"]}}function Oh(r,t,e){const n=r.getShaderParameter(t,r.COMPILE_STATUS),i=r.getShaderInfoLog(t).trim();if(n&&i==="")return"";const s=/ERROR: 0:(\d+)/.exec(i);if(s){const o=parseInt(s[1]);return e.toUpperCase()+`

`+i+`

`+c1(r.getShaderSource(t),o)}else return i}function h1(r,t){const e=l1(t);return`vec4 ${r}( vec4 value ) { return ${e[0]}( ${e[1]}( value ) ); }`}function u1(r,t){let e;switch(t){case Xu:e="Linear";break;case ju:e="Reinhard";break;case xd:e="Cineon";break;case Yu:e="ACESFilmic";break;case $u:e="AgX";break;case Ku:e="Neutral";break;case _d:e="Custom";break;default:console.warn("THREE.WebGLProgram: Unsupported toneMapping:",t),e="Linear"}return"vec3 "+r+"( vec3 color ) { return "+e+"ToneMapping( color ); }"}const so=new A;function d1(){me.getLuminanceCoefficients(so);const r=so.x.toFixed(4),t=so.y.toFixed(4),e=so.z.toFixed(4);return["float luminance( const in vec3 rgb ) {",`	const vec3 weights = vec3( ${r}, ${t}, ${e} );`,"	return dot( weights, rgb );","}"].join(`
`)}function f1(r){return[r.extensionClipCullDistance?"#extension GL_ANGLE_clip_cull_distance : require":"",r.extensionMultiDraw?"#extension GL_ANGLE_multi_draw : require":""].filter(br).join(`
`)}function p1(r){const t=[];for(const e in r){const n=r[e];n!==!1&&t.push("#define "+e+" "+n)}return t.join(`
`)}function m1(r,t){const e={},n=r.getProgramParameter(t,r.ACTIVE_ATTRIBUTES);for(let i=0;i<n;i++){const s=r.getActiveAttrib(t,i),o=s.name;let a=1;s.type===r.FLOAT_MAT2&&(a=2),s.type===r.FLOAT_MAT3&&(a=3),s.type===r.FLOAT_MAT4&&(a=4),e[o]={type:s.type,location:r.getAttribLocation(t,o),locationSize:a}}return e}function br(r){return r!==""}function Hh(r,t){const e=t.numSpotLightShadows+t.numSpotLightMaps-t.numSpotLightShadowsWithMaps;return r.replace(/NUM_DIR_LIGHTS/g,t.numDirLights).replace(/NUM_SPOT_LIGHTS/g,t.numSpotLights).replace(/NUM_SPOT_LIGHT_MAPS/g,t.numSpotLightMaps).replace(/NUM_SPOT_LIGHT_COORDS/g,e).replace(/NUM_RECT_AREA_LIGHTS/g,t.numRectAreaLights).replace(/NUM_POINT_LIGHTS/g,t.numPointLights).replace(/NUM_HEMI_LIGHTS/g,t.numHemiLights).replace(/NUM_DIR_LIGHT_SHADOWS/g,t.numDirLightShadows).replace(/NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS/g,t.numSpotLightShadowsWithMaps).replace(/NUM_SPOT_LIGHT_SHADOWS/g,t.numSpotLightShadows).replace(/NUM_POINT_LIGHT_SHADOWS/g,t.numPointLightShadows)}function Vh(r,t){return r.replace(/NUM_CLIPPING_PLANES/g,t.numClippingPlanes).replace(/UNION_CLIPPING_PLANES/g,t.numClippingPlanes-t.numClipIntersection)}const g1=/^[ \t]*#include +<([\w\d./]+)>/gm;function el(r){return r.replace(g1,x1)}const v1=new Map;function x1(r,t){let e=ee[t];if(e===void 0){const n=v1.get(t);if(n!==void 0)e=ee[n],console.warn('THREE.WebGLRenderer: Shader chunk "%s" has been deprecated. Use "%s" instead.',t,n);else throw new Error("Can not resolve #include <"+t+">")}return el(e)}const _1=/#pragma unroll_loop_start\s+for\s*\(\s*int\s+i\s*=\s*(\d+)\s*;\s*i\s*<\s*(\d+)\s*;\s*i\s*\+\+\s*\)\s*{([\s\S]+?)}\s+#pragma unroll_loop_end/g;function Gh(r){return r.replace(_1,y1)}function y1(r,t,e,n){let i="";for(let s=parseInt(t);s<parseInt(e);s++)i+=n.replace(/\[\s*i\s*\]/g,"[ "+s+" ]").replace(/UNROLLED_LOOP_INDEX/g,s);return i}function Wh(r){let t=`precision ${r.precision} float;
	precision ${r.precision} int;
	precision ${r.precision} sampler2D;
	precision ${r.precision} samplerCube;
	precision ${r.precision} sampler3D;
	precision ${r.precision} sampler2DArray;
	precision ${r.precision} sampler2DShadow;
	precision ${r.precision} samplerCubeShadow;
	precision ${r.precision} sampler2DArrayShadow;
	precision ${r.precision} isampler2D;
	precision ${r.precision} isampler3D;
	precision ${r.precision} isamplerCube;
	precision ${r.precision} isampler2DArray;
	precision ${r.precision} usampler2D;
	precision ${r.precision} usampler3D;
	precision ${r.precision} usamplerCube;
	precision ${r.precision} usampler2DArray;
	`;return r.precision==="highp"?t+=`
#define HIGH_PRECISION`:r.precision==="mediump"?t+=`
#define MEDIUM_PRECISION`:r.precision==="lowp"&&(t+=`
#define LOW_PRECISION`),t}function M1(r){let t="SHADOWMAP_TYPE_BASIC";return r.shadowMapType===Gu?t="SHADOWMAP_TYPE_PCF":r.shadowMapType===Wu?t="SHADOWMAP_TYPE_PCF_SOFT":r.shadowMapType===li&&(t="SHADOWMAP_TYPE_VSM"),t}function b1(r){let t="ENVMAP_TYPE_CUBE";if(r.envMap)switch(r.envMapMode){case Os:case Hs:t="ENVMAP_TYPE_CUBE";break;case Jo:t="ENVMAP_TYPE_CUBE_UV";break}return t}function S1(r){let t="ENVMAP_MODE_REFLECTION";if(r.envMap)switch(r.envMapMode){case Hs:t="ENVMAP_MODE_REFRACTION";break}return t}function w1(r){let t="ENVMAP_BLENDING_NONE";if(r.envMap)switch(r.combine){case qu:t="ENVMAP_BLENDING_MULTIPLY";break;case gd:t="ENVMAP_BLENDING_MIX";break;case vd:t="ENVMAP_BLENDING_ADD";break}return t}function T1(r){const t=r.envMapCubeUVHeight;if(t===null)return null;const e=Math.log2(t)-2,n=1/t;return{texelWidth:1/(3*Math.max(Math.pow(2,e),7*16)),texelHeight:n,maxMip:e}}function E1(r,t,e,n){const i=r.getContext(),s=e.defines;let o=e.vertexShader,a=e.fragmentShader;const c=M1(e),l=b1(e),h=S1(e),d=w1(e),f=T1(e),u=f1(e),m=p1(s),v=i.createProgram();let p,g,x=e.glslVersion?"#version "+e.glslVersion+`
`:"";e.isRawShaderMaterial?(p=["#define SHADER_TYPE "+e.shaderType,"#define SHADER_NAME "+e.shaderName,m].filter(br).join(`
`),p.length>0&&(p+=`
`),g=["#define SHADER_TYPE "+e.shaderType,"#define SHADER_NAME "+e.shaderName,m].filter(br).join(`
`),g.length>0&&(g+=`
`)):(p=[Wh(e),"#define SHADER_TYPE "+e.shaderType,"#define SHADER_NAME "+e.shaderName,m,e.extensionClipCullDistance?"#define USE_CLIP_DISTANCE":"",e.batching?"#define USE_BATCHING":"",e.batchingColor?"#define USE_BATCHING_COLOR":"",e.instancing?"#define USE_INSTANCING":"",e.instancingColor?"#define USE_INSTANCING_COLOR":"",e.instancingMorph?"#define USE_INSTANCING_MORPH":"",e.useFog&&e.fog?"#define USE_FOG":"",e.useFog&&e.fogExp2?"#define FOG_EXP2":"",e.map?"#define USE_MAP":"",e.envMap?"#define USE_ENVMAP":"",e.envMap?"#define "+h:"",e.lightMap?"#define USE_LIGHTMAP":"",e.aoMap?"#define USE_AOMAP":"",e.bumpMap?"#define USE_BUMPMAP":"",e.normalMap?"#define USE_NORMALMAP":"",e.normalMapObjectSpace?"#define USE_NORMALMAP_OBJECTSPACE":"",e.normalMapTangentSpace?"#define USE_NORMALMAP_TANGENTSPACE":"",e.displacementMap?"#define USE_DISPLACEMENTMAP":"",e.emissiveMap?"#define USE_EMISSIVEMAP":"",e.anisotropy?"#define USE_ANISOTROPY":"",e.anisotropyMap?"#define USE_ANISOTROPYMAP":"",e.clearcoatMap?"#define USE_CLEARCOATMAP":"",e.clearcoatRoughnessMap?"#define USE_CLEARCOAT_ROUGHNESSMAP":"",e.clearcoatNormalMap?"#define USE_CLEARCOAT_NORMALMAP":"",e.iridescenceMap?"#define USE_IRIDESCENCEMAP":"",e.iridescenceThicknessMap?"#define USE_IRIDESCENCE_THICKNESSMAP":"",e.specularMap?"#define USE_SPECULARMAP":"",e.specularColorMap?"#define USE_SPECULAR_COLORMAP":"",e.specularIntensityMap?"#define USE_SPECULAR_INTENSITYMAP":"",e.roughnessMap?"#define USE_ROUGHNESSMAP":"",e.metalnessMap?"#define USE_METALNESSMAP":"",e.alphaMap?"#define USE_ALPHAMAP":"",e.alphaHash?"#define USE_ALPHAHASH":"",e.transmission?"#define USE_TRANSMISSION":"",e.transmissionMap?"#define USE_TRANSMISSIONMAP":"",e.thicknessMap?"#define USE_THICKNESSMAP":"",e.sheenColorMap?"#define USE_SHEEN_COLORMAP":"",e.sheenRoughnessMap?"#define USE_SHEEN_ROUGHNESSMAP":"",e.mapUv?"#define MAP_UV "+e.mapUv:"",e.alphaMapUv?"#define ALPHAMAP_UV "+e.alphaMapUv:"",e.lightMapUv?"#define LIGHTMAP_UV "+e.lightMapUv:"",e.aoMapUv?"#define AOMAP_UV "+e.aoMapUv:"",e.emissiveMapUv?"#define EMISSIVEMAP_UV "+e.emissiveMapUv:"",e.bumpMapUv?"#define BUMPMAP_UV "+e.bumpMapUv:"",e.normalMapUv?"#define NORMALMAP_UV "+e.normalMapUv:"",e.displacementMapUv?"#define DISPLACEMENTMAP_UV "+e.displacementMapUv:"",e.metalnessMapUv?"#define METALNESSMAP_UV "+e.metalnessMapUv:"",e.roughnessMapUv?"#define ROUGHNESSMAP_UV "+e.roughnessMapUv:"",e.anisotropyMapUv?"#define ANISOTROPYMAP_UV "+e.anisotropyMapUv:"",e.clearcoatMapUv?"#define CLEARCOATMAP_UV "+e.clearcoatMapUv:"",e.clearcoatNormalMapUv?"#define CLEARCOAT_NORMALMAP_UV "+e.clearcoatNormalMapUv:"",e.clearcoatRoughnessMapUv?"#define CLEARCOAT_ROUGHNESSMAP_UV "+e.clearcoatRoughnessMapUv:"",e.iridescenceMapUv?"#define IRIDESCENCEMAP_UV "+e.iridescenceMapUv:"",e.iridescenceThicknessMapUv?"#define IRIDESCENCE_THICKNESSMAP_UV "+e.iridescenceThicknessMapUv:"",e.sheenColorMapUv?"#define SHEEN_COLORMAP_UV "+e.sheenColorMapUv:"",e.sheenRoughnessMapUv?"#define SHEEN_ROUGHNESSMAP_UV "+e.sheenRoughnessMapUv:"",e.specularMapUv?"#define SPECULARMAP_UV "+e.specularMapUv:"",e.specularColorMapUv?"#define SPECULAR_COLORMAP_UV "+e.specularColorMapUv:"",e.specularIntensityMapUv?"#define SPECULAR_INTENSITYMAP_UV "+e.specularIntensityMapUv:"",e.transmissionMapUv?"#define TRANSMISSIONMAP_UV "+e.transmissionMapUv:"",e.thicknessMapUv?"#define THICKNESSMAP_UV "+e.thicknessMapUv:"",e.vertexTangents&&e.flatShading===!1?"#define USE_TANGENT":"",e.vertexColors?"#define USE_COLOR":"",e.vertexAlphas?"#define USE_COLOR_ALPHA":"",e.vertexUv1s?"#define USE_UV1":"",e.vertexUv2s?"#define USE_UV2":"",e.vertexUv3s?"#define USE_UV3":"",e.pointsUvs?"#define USE_POINTS_UV":"",e.flatShading?"#define FLAT_SHADED":"",e.skinning?"#define USE_SKINNING":"",e.morphTargets?"#define USE_MORPHTARGETS":"",e.morphNormals&&e.flatShading===!1?"#define USE_MORPHNORMALS":"",e.morphColors?"#define USE_MORPHCOLORS":"",e.morphTargetsCount>0?"#define MORPHTARGETS_TEXTURE_STRIDE "+e.morphTextureStride:"",e.morphTargetsCount>0?"#define MORPHTARGETS_COUNT "+e.morphTargetsCount:"",e.doubleSided?"#define DOUBLE_SIDED":"",e.flipSided?"#define FLIP_SIDED":"",e.shadowMapEnabled?"#define USE_SHADOWMAP":"",e.shadowMapEnabled?"#define "+c:"",e.sizeAttenuation?"#define USE_SIZEATTENUATION":"",e.numLightProbes>0?"#define USE_LIGHT_PROBES":"",e.logarithmicDepthBuffer?"#define USE_LOGDEPTHBUF":"",e.reverseDepthBuffer?"#define USE_REVERSEDEPTHBUF":"","uniform mat4 modelMatrix;","uniform mat4 modelViewMatrix;","uniform mat4 projectionMatrix;","uniform mat4 viewMatrix;","uniform mat3 normalMatrix;","uniform vec3 cameraPosition;","uniform bool isOrthographic;","#ifdef USE_INSTANCING","	attribute mat4 instanceMatrix;","#endif","#ifdef USE_INSTANCING_COLOR","	attribute vec3 instanceColor;","#endif","#ifdef USE_INSTANCING_MORPH","	uniform sampler2D morphTexture;","#endif","attribute vec3 position;","attribute vec3 normal;","attribute vec2 uv;","#ifdef USE_UV1","	attribute vec2 uv1;","#endif","#ifdef USE_UV2","	attribute vec2 uv2;","#endif","#ifdef USE_UV3","	attribute vec2 uv3;","#endif","#ifdef USE_TANGENT","	attribute vec4 tangent;","#endif","#if defined( USE_COLOR_ALPHA )","	attribute vec4 color;","#elif defined( USE_COLOR )","	attribute vec3 color;","#endif","#ifdef USE_SKINNING","	attribute vec4 skinIndex;","	attribute vec4 skinWeight;","#endif",`
`].filter(br).join(`
`),g=[Wh(e),"#define SHADER_TYPE "+e.shaderType,"#define SHADER_NAME "+e.shaderName,m,e.useFog&&e.fog?"#define USE_FOG":"",e.useFog&&e.fogExp2?"#define FOG_EXP2":"",e.alphaToCoverage?"#define ALPHA_TO_COVERAGE":"",e.map?"#define USE_MAP":"",e.matcap?"#define USE_MATCAP":"",e.envMap?"#define USE_ENVMAP":"",e.envMap?"#define "+l:"",e.envMap?"#define "+h:"",e.envMap?"#define "+d:"",f?"#define CUBEUV_TEXEL_WIDTH "+f.texelWidth:"",f?"#define CUBEUV_TEXEL_HEIGHT "+f.texelHeight:"",f?"#define CUBEUV_MAX_MIP "+f.maxMip+".0":"",e.lightMap?"#define USE_LIGHTMAP":"",e.aoMap?"#define USE_AOMAP":"",e.bumpMap?"#define USE_BUMPMAP":"",e.normalMap?"#define USE_NORMALMAP":"",e.normalMapObjectSpace?"#define USE_NORMALMAP_OBJECTSPACE":"",e.normalMapTangentSpace?"#define USE_NORMALMAP_TANGENTSPACE":"",e.emissiveMap?"#define USE_EMISSIVEMAP":"",e.anisotropy?"#define USE_ANISOTROPY":"",e.anisotropyMap?"#define USE_ANISOTROPYMAP":"",e.clearcoat?"#define USE_CLEARCOAT":"",e.clearcoatMap?"#define USE_CLEARCOATMAP":"",e.clearcoatRoughnessMap?"#define USE_CLEARCOAT_ROUGHNESSMAP":"",e.clearcoatNormalMap?"#define USE_CLEARCOAT_NORMALMAP":"",e.dispersion?"#define USE_DISPERSION":"",e.iridescence?"#define USE_IRIDESCENCE":"",e.iridescenceMap?"#define USE_IRIDESCENCEMAP":"",e.iridescenceThicknessMap?"#define USE_IRIDESCENCE_THICKNESSMAP":"",e.specularMap?"#define USE_SPECULARMAP":"",e.specularColorMap?"#define USE_SPECULAR_COLORMAP":"",e.specularIntensityMap?"#define USE_SPECULAR_INTENSITYMAP":"",e.roughnessMap?"#define USE_ROUGHNESSMAP":"",e.metalnessMap?"#define USE_METALNESSMAP":"",e.alphaMap?"#define USE_ALPHAMAP":"",e.alphaTest?"#define USE_ALPHATEST":"",e.alphaHash?"#define USE_ALPHAHASH":"",e.sheen?"#define USE_SHEEN":"",e.sheenColorMap?"#define USE_SHEEN_COLORMAP":"",e.sheenRoughnessMap?"#define USE_SHEEN_ROUGHNESSMAP":"",e.transmission?"#define USE_TRANSMISSION":"",e.transmissionMap?"#define USE_TRANSMISSIONMAP":"",e.thicknessMap?"#define USE_THICKNESSMAP":"",e.vertexTangents&&e.flatShading===!1?"#define USE_TANGENT":"",e.vertexColors||e.instancingColor||e.batchingColor?"#define USE_COLOR":"",e.vertexAlphas?"#define USE_COLOR_ALPHA":"",e.vertexUv1s?"#define USE_UV1":"",e.vertexUv2s?"#define USE_UV2":"",e.vertexUv3s?"#define USE_UV3":"",e.pointsUvs?"#define USE_POINTS_UV":"",e.gradientMap?"#define USE_GRADIENTMAP":"",e.flatShading?"#define FLAT_SHADED":"",e.doubleSided?"#define DOUBLE_SIDED":"",e.flipSided?"#define FLIP_SIDED":"",e.shadowMapEnabled?"#define USE_SHADOWMAP":"",e.shadowMapEnabled?"#define "+c:"",e.premultipliedAlpha?"#define PREMULTIPLIED_ALPHA":"",e.numLightProbes>0?"#define USE_LIGHT_PROBES":"",e.decodeVideoTexture?"#define DECODE_VIDEO_TEXTURE":"",e.logarithmicDepthBuffer?"#define USE_LOGDEPTHBUF":"",e.reverseDepthBuffer?"#define USE_REVERSEDEPTHBUF":"","uniform mat4 viewMatrix;","uniform vec3 cameraPosition;","uniform bool isOrthographic;",e.toneMapping!==Yn?"#define TONE_MAPPING":"",e.toneMapping!==Yn?ee.tonemapping_pars_fragment:"",e.toneMapping!==Yn?u1("toneMapping",e.toneMapping):"",e.dithering?"#define DITHERING":"",e.opaque?"#define OPAQUE":"",ee.colorspace_pars_fragment,h1("linearToOutputTexel",e.outputColorSpace),d1(),e.useDepthPacking?"#define DEPTH_PACKING "+e.depthPacking:"",`
`].filter(br).join(`
`)),o=el(o),o=Hh(o,e),o=Vh(o,e),a=el(a),a=Hh(a,e),a=Vh(a,e),o=Gh(o),a=Gh(a),e.isRawShaderMaterial!==!0&&(x=`#version 300 es
`,p=[u,"#define attribute in","#define varying out","#define texture2D texture"].join(`
`)+`
`+p,g=["#define varying in",e.glslVersion===ah?"":"layout(location = 0) out highp vec4 pc_fragColor;",e.glslVersion===ah?"":"#define gl_FragColor pc_fragColor","#define gl_FragDepthEXT gl_FragDepth","#define texture2D texture","#define textureCube texture","#define texture2DProj textureProj","#define texture2DLodEXT textureLod","#define texture2DProjLodEXT textureProjLod","#define textureCubeLodEXT textureLod","#define texture2DGradEXT textureGrad","#define texture2DProjGradEXT textureProjGrad","#define textureCubeGradEXT textureGrad"].join(`
`)+`
`+g);const _=x+p+o,y=x+g+a,w=Bh(i,i.VERTEX_SHADER,_),T=Bh(i,i.FRAGMENT_SHADER,y);i.attachShader(v,w),i.attachShader(v,T),e.index0AttributeName!==void 0?i.bindAttribLocation(v,0,e.index0AttributeName):e.morphTargets===!0&&i.bindAttribLocation(v,0,"position"),i.linkProgram(v);function R(S){if(r.debug.checkShaderErrors){const k=i.getProgramInfoLog(v).trim(),N=i.getShaderInfoLog(w).trim(),z=i.getShaderInfoLog(T).trim();let H=!0,L=!0;if(i.getProgramParameter(v,i.LINK_STATUS)===!1)if(H=!1,typeof r.debug.onShaderError=="function")r.debug.onShaderError(i,v,w,T);else{const V=Oh(i,w,"vertex"),O=Oh(i,T,"fragment");console.error("THREE.WebGLProgram: Shader Error "+i.getError()+" - VALIDATE_STATUS "+i.getProgramParameter(v,i.VALIDATE_STATUS)+`

Material Name: `+S.name+`
Material Type: `+S.type+`

Program Info Log: `+k+`
`+V+`
`+O)}else k!==""?console.warn("THREE.WebGLProgram: Program Info Log:",k):(N===""||z==="")&&(L=!1);L&&(S.diagnostics={runnable:H,programLog:k,vertexShader:{log:N,prefix:p},fragmentShader:{log:z,prefix:g}})}i.deleteShader(w),i.deleteShader(T),E=new Do(i,v),D=m1(i,v)}let E;this.getUniforms=function(){return E===void 0&&R(this),E};let D;this.getAttributes=function(){return D===void 0&&R(this),D};let M=e.rendererExtensionParallelShaderCompile===!1;return this.isReady=function(){return M===!1&&(M=i.getProgramParameter(v,o1)),M},this.destroy=function(){n.releaseStatesOfProgram(this),i.deleteProgram(v),this.program=void 0},this.type=e.shaderType,this.name=e.shaderName,this.id=a1++,this.cacheKey=t,this.usedTimes=1,this.program=v,this.vertexShader=w,this.fragmentShader=T,this}let A1=0;class R1{constructor(){this.shaderCache=new Map,this.materialCache=new Map}update(t){const e=t.vertexShader,n=t.fragmentShader,i=this._getShaderStage(e),s=this._getShaderStage(n),o=this._getShaderCacheForMaterial(t);return o.has(i)===!1&&(o.add(i),i.usedTimes++),o.has(s)===!1&&(o.add(s),s.usedTimes++),this}remove(t){const e=this.materialCache.get(t);for(const n of e)n.usedTimes--,n.usedTimes===0&&this.shaderCache.delete(n.code);return this.materialCache.delete(t),this}getVertexShaderID(t){return this._getShaderStage(t.vertexShader).id}getFragmentShaderID(t){return this._getShaderStage(t.fragmentShader).id}dispose(){this.shaderCache.clear(),this.materialCache.clear()}_getShaderCacheForMaterial(t){const e=this.materialCache;let n=e.get(t);return n===void 0&&(n=new Set,e.set(t,n)),n}_getShaderStage(t){const e=this.shaderCache;let n=e.get(t);return n===void 0&&(n=new C1(t),e.set(t,n)),n}}class C1{constructor(t){this.id=A1++,this.code=t,this.usedTimes=0}}function P1(r,t,e,n,i,s,o){const a=new u0,c=new R1,l=new Set,h=[],d=i.logarithmicDepthBuffer,f=i.reverseDepthBuffer,u=i.vertexTextures;let m=i.precision;const v={MeshDepthMaterial:"depth",MeshDistanceMaterial:"distanceRGBA",MeshNormalMaterial:"normal",MeshBasicMaterial:"basic",MeshLambertMaterial:"lambert",MeshPhongMaterial:"phong",MeshToonMaterial:"toon",MeshStandardMaterial:"physical",MeshPhysicalMaterial:"physical",MeshMatcapMaterial:"matcap",LineBasicMaterial:"basic",LineDashedMaterial:"dashed",PointsMaterial:"points",ShadowMaterial:"shadow",SpriteMaterial:"sprite"};function p(M){return l.add(M),M===0?"uv":`uv${M}`}function g(M,S,k,N,z){const H=N.fog,L=z.geometry,V=M.isMeshStandardMaterial?N.environment:null,O=(M.isMeshStandardMaterial?e:t).get(M.envMap||V),P=O&&O.mapping===Jo?O.image.height:null,B=v[M.type];M.precision!==null&&(m=i.getMaxPrecision(M.precision),m!==M.precision&&console.warn("THREE.WebGLProgram.getParameters:",M.precision,"not supported, using",m,"instead."));const G=L.morphAttributes.position||L.morphAttributes.normal||L.morphAttributes.color,Q=G!==void 0?G.length:0;let ut=0;L.morphAttributes.position!==void 0&&(ut=1),L.morphAttributes.normal!==void 0&&(ut=2),L.morphAttributes.color!==void 0&&(ut=3);let X,Z,rt,J;if(B){const hn=qn[B];X=hn.vertexShader,Z=hn.fragmentShader}else X=M.vertexShader,Z=M.fragmentShader,c.update(M),rt=c.getVertexShaderID(M),J=c.getFragmentShaderID(M);const ot=r.getRenderTarget(),lt=z.isInstancedMesh===!0,bt=z.isBatchedMesh===!0,At=!!M.map,st=!!M.matcap,F=!!O,Gt=!!M.aoMap,Lt=!!M.lightMap,vt=!!M.bumpMap,ft=!!M.normalMap,Kt=!!M.displacementMap,mt=!!M.emissiveMap,U=!!M.metalnessMap,C=!!M.roughnessMap,Y=M.anisotropy>0,nt=M.clearcoat>0,ht=M.dispersion>0,it=M.iridescence>0,Nt=M.sheen>0,_t=M.transmission>0,Tt=Y&&!!M.anisotropyMap,se=nt&&!!M.clearcoatMap,pt=nt&&!!M.clearcoatNormalMap,Et=nt&&!!M.clearcoatRoughnessMap,Ot=it&&!!M.iridescenceMap,Wt=it&&!!M.iridescenceThicknessMap,Rt=Nt&&!!M.sheenColorMap,ae=Nt&&!!M.sheenRoughnessMap,Jt=!!M.specularMap,be=!!M.specularColorMap,W=!!M.specularIntensityMap,St=_t&&!!M.transmissionMap,tt=_t&&!!M.thicknessMap,at=!!M.gradientMap,yt=!!M.alphaMap,wt=M.alphaTest>0,ce=!!M.alphaHash,Ne=!!M.extensions;let ln=Yn;M.toneMapped&&(ot===null||ot.isXRRenderTarget===!0)&&(ln=r.toneMapping);const he={shaderID:B,shaderType:M.type,shaderName:M.name,vertexShader:X,fragmentShader:Z,defines:M.defines,customVertexShaderID:rt,customFragmentShaderID:J,isRawShaderMaterial:M.isRawShaderMaterial===!0,glslVersion:M.glslVersion,precision:m,batching:bt,batchingColor:bt&&z._colorsTexture!==null,instancing:lt,instancingColor:lt&&z.instanceColor!==null,instancingMorph:lt&&z.morphTexture!==null,supportsVertexTextures:u,outputColorSpace:ot===null?r.outputColorSpace:ot.isXRRenderTarget===!0?ot.texture.colorSpace:Hi,alphaToCoverage:!!M.alphaToCoverage,map:At,matcap:st,envMap:F,envMapMode:F&&O.mapping,envMapCubeUVHeight:P,aoMap:Gt,lightMap:Lt,bumpMap:vt,normalMap:ft,displacementMap:u&&Kt,emissiveMap:mt,normalMapObjectSpace:ft&&M.normalMapType===wd,normalMapTangentSpace:ft&&M.normalMapType===o0,metalnessMap:U,roughnessMap:C,anisotropy:Y,anisotropyMap:Tt,clearcoat:nt,clearcoatMap:se,clearcoatNormalMap:pt,clearcoatRoughnessMap:Et,dispersion:ht,iridescence:it,iridescenceMap:Ot,iridescenceThicknessMap:Wt,sheen:Nt,sheenColorMap:Rt,sheenRoughnessMap:ae,specularMap:Jt,specularColorMap:be,specularIntensityMap:W,transmission:_t,transmissionMap:St,thicknessMap:tt,gradientMap:at,opaque:M.transparent===!1&&M.blending===ss&&M.alphaToCoverage===!1,alphaMap:yt,alphaTest:wt,alphaHash:ce,combine:M.combine,mapUv:At&&p(M.map.channel),aoMapUv:Gt&&p(M.aoMap.channel),lightMapUv:Lt&&p(M.lightMap.channel),bumpMapUv:vt&&p(M.bumpMap.channel),normalMapUv:ft&&p(M.normalMap.channel),displacementMapUv:Kt&&p(M.displacementMap.channel),emissiveMapUv:mt&&p(M.emissiveMap.channel),metalnessMapUv:U&&p(M.metalnessMap.channel),roughnessMapUv:C&&p(M.roughnessMap.channel),anisotropyMapUv:Tt&&p(M.anisotropyMap.channel),clearcoatMapUv:se&&p(M.clearcoatMap.channel),clearcoatNormalMapUv:pt&&p(M.clearcoatNormalMap.channel),clearcoatRoughnessMapUv:Et&&p(M.clearcoatRoughnessMap.channel),iridescenceMapUv:Ot&&p(M.iridescenceMap.channel),iridescenceThicknessMapUv:Wt&&p(M.iridescenceThicknessMap.channel),sheenColorMapUv:Rt&&p(M.sheenColorMap.channel),sheenRoughnessMapUv:ae&&p(M.sheenRoughnessMap.channel),specularMapUv:Jt&&p(M.specularMap.channel),specularColorMapUv:be&&p(M.specularColorMap.channel),specularIntensityMapUv:W&&p(M.specularIntensityMap.channel),transmissionMapUv:St&&p(M.transmissionMap.channel),thicknessMapUv:tt&&p(M.thicknessMap.channel),alphaMapUv:yt&&p(M.alphaMap.channel),vertexTangents:!!L.attributes.tangent&&(ft||Y),vertexColors:M.vertexColors,vertexAlphas:M.vertexColors===!0&&!!L.attributes.color&&L.attributes.color.itemSize===4,pointsUvs:z.isPoints===!0&&!!L.attributes.uv&&(At||yt),fog:!!H,useFog:M.fog===!0,fogExp2:!!H&&H.isFogExp2,flatShading:M.flatShading===!0,sizeAttenuation:M.sizeAttenuation===!0,logarithmicDepthBuffer:d,reverseDepthBuffer:f,skinning:z.isSkinnedMesh===!0,morphTargets:L.morphAttributes.position!==void 0,morphNormals:L.morphAttributes.normal!==void 0,morphColors:L.morphAttributes.color!==void 0,morphTargetsCount:Q,morphTextureStride:ut,numDirLights:S.directional.length,numPointLights:S.point.length,numSpotLights:S.spot.length,numSpotLightMaps:S.spotLightMap.length,numRectAreaLights:S.rectArea.length,numHemiLights:S.hemi.length,numDirLightShadows:S.directionalShadowMap.length,numPointLightShadows:S.pointShadowMap.length,numSpotLightShadows:S.spotShadowMap.length,numSpotLightShadowsWithMaps:S.numSpotLightShadowsWithMaps,numLightProbes:S.numLightProbes,numClippingPlanes:o.numPlanes,numClipIntersection:o.numIntersection,dithering:M.dithering,shadowMapEnabled:r.shadowMap.enabled&&k.length>0,shadowMapType:r.shadowMap.type,toneMapping:ln,decodeVideoTexture:At&&M.map.isVideoTexture===!0&&me.getTransfer(M.map.colorSpace)===Ee,premultipliedAlpha:M.premultipliedAlpha,doubleSided:M.side===cn,flipSided:M.side===sn,useDepthPacking:M.depthPacking>=0,depthPacking:M.depthPacking||0,index0AttributeName:M.index0AttributeName,extensionClipCullDistance:Ne&&M.extensions.clipCullDistance===!0&&n.has("WEBGL_clip_cull_distance"),extensionMultiDraw:(Ne&&M.extensions.multiDraw===!0||bt)&&n.has("WEBGL_multi_draw"),rendererExtensionParallelShaderCompile:n.has("KHR_parallel_shader_compile"),customProgramCacheKey:M.customProgramCacheKey()};return he.vertexUv1s=l.has(1),he.vertexUv2s=l.has(2),he.vertexUv3s=l.has(3),l.clear(),he}function x(M){const S=[];if(M.shaderID?S.push(M.shaderID):(S.push(M.customVertexShaderID),S.push(M.customFragmentShaderID)),M.defines!==void 0)for(const k in M.defines)S.push(k),S.push(M.defines[k]);return M.isRawShaderMaterial===!1&&(_(S,M),y(S,M),S.push(r.outputColorSpace)),S.push(M.customProgramCacheKey),S.join()}function _(M,S){M.push(S.precision),M.push(S.outputColorSpace),M.push(S.envMapMode),M.push(S.envMapCubeUVHeight),M.push(S.mapUv),M.push(S.alphaMapUv),M.push(S.lightMapUv),M.push(S.aoMapUv),M.push(S.bumpMapUv),M.push(S.normalMapUv),M.push(S.displacementMapUv),M.push(S.emissiveMapUv),M.push(S.metalnessMapUv),M.push(S.roughnessMapUv),M.push(S.anisotropyMapUv),M.push(S.clearcoatMapUv),M.push(S.clearcoatNormalMapUv),M.push(S.clearcoatRoughnessMapUv),M.push(S.iridescenceMapUv),M.push(S.iridescenceThicknessMapUv),M.push(S.sheenColorMapUv),M.push(S.sheenRoughnessMapUv),M.push(S.specularMapUv),M.push(S.specularColorMapUv),M.push(S.specularIntensityMapUv),M.push(S.transmissionMapUv),M.push(S.thicknessMapUv),M.push(S.combine),M.push(S.fogExp2),M.push(S.sizeAttenuation),M.push(S.morphTargetsCount),M.push(S.morphAttributeCount),M.push(S.numDirLights),M.push(S.numPointLights),M.push(S.numSpotLights),M.push(S.numSpotLightMaps),M.push(S.numHemiLights),M.push(S.numRectAreaLights),M.push(S.numDirLightShadows),M.push(S.numPointLightShadows),M.push(S.numSpotLightShadows),M.push(S.numSpotLightShadowsWithMaps),M.push(S.numLightProbes),M.push(S.shadowMapType),M.push(S.toneMapping),M.push(S.numClippingPlanes),M.push(S.numClipIntersection),M.push(S.depthPacking)}function y(M,S){a.disableAll(),S.supportsVertexTextures&&a.enable(0),S.instancing&&a.enable(1),S.instancingColor&&a.enable(2),S.instancingMorph&&a.enable(3),S.matcap&&a.enable(4),S.envMap&&a.enable(5),S.normalMapObjectSpace&&a.enable(6),S.normalMapTangentSpace&&a.enable(7),S.clearcoat&&a.enable(8),S.iridescence&&a.enable(9),S.alphaTest&&a.enable(10),S.vertexColors&&a.enable(11),S.vertexAlphas&&a.enable(12),S.vertexUv1s&&a.enable(13),S.vertexUv2s&&a.enable(14),S.vertexUv3s&&a.enable(15),S.vertexTangents&&a.enable(16),S.anisotropy&&a.enable(17),S.alphaHash&&a.enable(18),S.batching&&a.enable(19),S.dispersion&&a.enable(20),S.batchingColor&&a.enable(21),M.push(a.mask),a.disableAll(),S.fog&&a.enable(0),S.useFog&&a.enable(1),S.flatShading&&a.enable(2),S.logarithmicDepthBuffer&&a.enable(3),S.reverseDepthBuffer&&a.enable(4),S.skinning&&a.enable(5),S.morphTargets&&a.enable(6),S.morphNormals&&a.enable(7),S.morphColors&&a.enable(8),S.premultipliedAlpha&&a.enable(9),S.shadowMapEnabled&&a.enable(10),S.doubleSided&&a.enable(11),S.flipSided&&a.enable(12),S.useDepthPacking&&a.enable(13),S.dithering&&a.enable(14),S.transmission&&a.enable(15),S.sheen&&a.enable(16),S.opaque&&a.enable(17),S.pointsUvs&&a.enable(18),S.decodeVideoTexture&&a.enable(19),S.alphaToCoverage&&a.enable(20),M.push(a.mask)}function w(M){const S=v[M.type];let k;if(S){const N=qn[S];k=m0.clone(N.uniforms)}else k=M.uniforms;return k}function T(M,S){let k;for(let N=0,z=h.length;N<z;N++){const H=h[N];if(H.cacheKey===S){k=H,++k.usedTimes;break}}return k===void 0&&(k=new E1(r,S,M,s),h.push(k)),k}function R(M){if(--M.usedTimes===0){const S=h.indexOf(M);h[S]=h[h.length-1],h.pop(),M.destroy()}}function E(M){c.remove(M)}function D(){c.dispose()}return{getParameters:g,getProgramCacheKey:x,getUniforms:w,acquireProgram:T,releaseProgram:R,releaseShaderCache:E,programs:h,dispose:D}}function L1(){let r=new WeakMap;function t(o){return r.has(o)}function e(o){let a=r.get(o);return a===void 0&&(a={},r.set(o,a)),a}function n(o){r.delete(o)}function i(o,a,c){r.get(o)[a]=c}function s(){r=new WeakMap}return{has:t,get:e,remove:n,update:i,dispose:s}}function k1(r,t){return r.groupOrder!==t.groupOrder?r.groupOrder-t.groupOrder:r.renderOrder!==t.renderOrder?r.renderOrder-t.renderOrder:r.material.id!==t.material.id?r.material.id-t.material.id:r.z!==t.z?r.z-t.z:r.id-t.id}function qh(r,t){return r.groupOrder!==t.groupOrder?r.groupOrder-t.groupOrder:r.renderOrder!==t.renderOrder?r.renderOrder-t.renderOrder:r.z!==t.z?t.z-r.z:r.id-t.id}function Xh(){const r=[];let t=0;const e=[],n=[],i=[];function s(){t=0,e.length=0,n.length=0,i.length=0}function o(d,f,u,m,v,p){let g=r[t];return g===void 0?(g={id:d.id,object:d,geometry:f,material:u,groupOrder:m,renderOrder:d.renderOrder,z:v,group:p},r[t]=g):(g.id=d.id,g.object=d,g.geometry=f,g.material=u,g.groupOrder=m,g.renderOrder=d.renderOrder,g.z=v,g.group=p),t++,g}function a(d,f,u,m,v,p){const g=o(d,f,u,m,v,p);u.transmission>0?n.push(g):u.transparent===!0?i.push(g):e.push(g)}function c(d,f,u,m,v,p){const g=o(d,f,u,m,v,p);u.transmission>0?n.unshift(g):u.transparent===!0?i.unshift(g):e.unshift(g)}function l(d,f){e.length>1&&e.sort(d||k1),n.length>1&&n.sort(f||qh),i.length>1&&i.sort(f||qh)}function h(){for(let d=t,f=r.length;d<f;d++){const u=r[d];if(u.id===null)break;u.id=null,u.object=null,u.geometry=null,u.material=null,u.group=null}}return{opaque:e,transmissive:n,transparent:i,init:s,push:a,unshift:c,finish:h,sort:l}}function D1(){let r=new WeakMap;function t(n,i){const s=r.get(n);let o;return s===void 0?(o=new Xh,r.set(n,[o])):i>=s.length?(o=new Xh,s.push(o)):o=s[i],o}function e(){r=new WeakMap}return{get:t,dispose:e}}function I1(){const r={};return{get:function(t){if(r[t.id]!==void 0)return r[t.id];let e;switch(t.type){case"DirectionalLight":e={direction:new A,color:new dt};break;case"SpotLight":e={position:new A,direction:new A,color:new dt,distance:0,coneCos:0,penumbraCos:0,decay:0};break;case"PointLight":e={position:new A,color:new dt,distance:0,decay:0};break;case"HemisphereLight":e={direction:new A,skyColor:new dt,groundColor:new dt};break;case"RectAreaLight":e={color:new dt,position:new A,halfWidth:new A,halfHeight:new A};break}return r[t.id]=e,e}}}function N1(){const r={};return{get:function(t){if(r[t.id]!==void 0)return r[t.id];let e;switch(t.type){case"DirectionalLight":e={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new ct};break;case"SpotLight":e={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new ct};break;case"PointLight":e={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new ct,shadowCameraNear:1,shadowCameraFar:1e3};break}return r[t.id]=e,e}}}let U1=0;function z1(r,t){return(t.castShadow?2:0)-(r.castShadow?2:0)+(t.map?1:0)-(r.map?1:0)}function F1(r){const t=new I1,e=N1(),n={version:0,hash:{directionalLength:-1,pointLength:-1,spotLength:-1,rectAreaLength:-1,hemiLength:-1,numDirectionalShadows:-1,numPointShadows:-1,numSpotShadows:-1,numSpotMaps:-1,numLightProbes:-1},ambient:[0,0,0],probe:[],directional:[],directionalShadow:[],directionalShadowMap:[],directionalShadowMatrix:[],spot:[],spotLightMap:[],spotShadow:[],spotShadowMap:[],spotLightMatrix:[],rectArea:[],rectAreaLTC1:null,rectAreaLTC2:null,point:[],pointShadow:[],pointShadowMap:[],pointShadowMatrix:[],hemi:[],numSpotLightShadowsWithMaps:0,numLightProbes:0};for(let l=0;l<9;l++)n.probe.push(new A);const i=new A,s=new Dt,o=new Dt;function a(l){let h=0,d=0,f=0;for(let D=0;D<9;D++)n.probe[D].set(0,0,0);let u=0,m=0,v=0,p=0,g=0,x=0,_=0,y=0,w=0,T=0,R=0;l.sort(z1);for(let D=0,M=l.length;D<M;D++){const S=l[D],k=S.color,N=S.intensity,z=S.distance,H=S.shadow&&S.shadow.map?S.shadow.map.texture:null;if(S.isAmbientLight)h+=k.r*N,d+=k.g*N,f+=k.b*N;else if(S.isLightProbe){for(let L=0;L<9;L++)n.probe[L].addScaledVector(S.sh.coefficients[L],N);R++}else if(S.isDirectionalLight){const L=t.get(S);if(L.color.copy(S.color).multiplyScalar(S.intensity),S.castShadow){const V=S.shadow,O=e.get(S);O.shadowIntensity=V.intensity,O.shadowBias=V.bias,O.shadowNormalBias=V.normalBias,O.shadowRadius=V.radius,O.shadowMapSize=V.mapSize,n.directionalShadow[u]=O,n.directionalShadowMap[u]=H,n.directionalShadowMatrix[u]=S.shadow.matrix,x++}n.directional[u]=L,u++}else if(S.isSpotLight){const L=t.get(S);L.position.setFromMatrixPosition(S.matrixWorld),L.color.copy(k).multiplyScalar(N),L.distance=z,L.coneCos=Math.cos(S.angle),L.penumbraCos=Math.cos(S.angle*(1-S.penumbra)),L.decay=S.decay,n.spot[v]=L;const V=S.shadow;if(S.map&&(n.spotLightMap[w]=S.map,w++,V.updateMatrices(S),S.castShadow&&T++),n.spotLightMatrix[v]=V.matrix,S.castShadow){const O=e.get(S);O.shadowIntensity=V.intensity,O.shadowBias=V.bias,O.shadowNormalBias=V.normalBias,O.shadowRadius=V.radius,O.shadowMapSize=V.mapSize,n.spotShadow[v]=O,n.spotShadowMap[v]=H,y++}v++}else if(S.isRectAreaLight){const L=t.get(S);L.color.copy(k).multiplyScalar(N),L.halfWidth.set(S.width*.5,0,0),L.halfHeight.set(0,S.height*.5,0),n.rectArea[p]=L,p++}else if(S.isPointLight){const L=t.get(S);if(L.color.copy(S.color).multiplyScalar(S.intensity),L.distance=S.distance,L.decay=S.decay,S.castShadow){const V=S.shadow,O=e.get(S);O.shadowIntensity=V.intensity,O.shadowBias=V.bias,O.shadowNormalBias=V.normalBias,O.shadowRadius=V.radius,O.shadowMapSize=V.mapSize,O.shadowCameraNear=V.camera.near,O.shadowCameraFar=V.camera.far,n.pointShadow[m]=O,n.pointShadowMap[m]=H,n.pointShadowMatrix[m]=S.shadow.matrix,_++}n.point[m]=L,m++}else if(S.isHemisphereLight){const L=t.get(S);L.skyColor.copy(S.color).multiplyScalar(N),L.groundColor.copy(S.groundColor).multiplyScalar(N),n.hemi[g]=L,g++}}p>0&&(r.has("OES_texture_float_linear")===!0?(n.rectAreaLTC1=xt.LTC_FLOAT_1,n.rectAreaLTC2=xt.LTC_FLOAT_2):(n.rectAreaLTC1=xt.LTC_HALF_1,n.rectAreaLTC2=xt.LTC_HALF_2)),n.ambient[0]=h,n.ambient[1]=d,n.ambient[2]=f;const E=n.hash;(E.directionalLength!==u||E.pointLength!==m||E.spotLength!==v||E.rectAreaLength!==p||E.hemiLength!==g||E.numDirectionalShadows!==x||E.numPointShadows!==_||E.numSpotShadows!==y||E.numSpotMaps!==w||E.numLightProbes!==R)&&(n.directional.length=u,n.spot.length=v,n.rectArea.length=p,n.point.length=m,n.hemi.length=g,n.directionalShadow.length=x,n.directionalShadowMap.length=x,n.pointShadow.length=_,n.pointShadowMap.length=_,n.spotShadow.length=y,n.spotShadowMap.length=y,n.directionalShadowMatrix.length=x,n.pointShadowMatrix.length=_,n.spotLightMatrix.length=y+w-T,n.spotLightMap.length=w,n.numSpotLightShadowsWithMaps=T,n.numLightProbes=R,E.directionalLength=u,E.pointLength=m,E.spotLength=v,E.rectAreaLength=p,E.hemiLength=g,E.numDirectionalShadows=x,E.numPointShadows=_,E.numSpotShadows=y,E.numSpotMaps=w,E.numLightProbes=R,n.version=U1++)}function c(l,h){let d=0,f=0,u=0,m=0,v=0;const p=h.matrixWorldInverse;for(let g=0,x=l.length;g<x;g++){const _=l[g];if(_.isDirectionalLight){const y=n.directional[d];y.direction.setFromMatrixPosition(_.matrixWorld),i.setFromMatrixPosition(_.target.matrixWorld),y.direction.sub(i),y.direction.transformDirection(p),d++}else if(_.isSpotLight){const y=n.spot[u];y.position.setFromMatrixPosition(_.matrixWorld),y.position.applyMatrix4(p),y.direction.setFromMatrixPosition(_.matrixWorld),i.setFromMatrixPosition(_.target.matrixWorld),y.direction.sub(i),y.direction.transformDirection(p),u++}else if(_.isRectAreaLight){const y=n.rectArea[m];y.position.setFromMatrixPosition(_.matrixWorld),y.position.applyMatrix4(p),o.identity(),s.copy(_.matrixWorld),s.premultiply(p),o.extractRotation(s),y.halfWidth.set(_.width*.5,0,0),y.halfHeight.set(0,_.height*.5,0),y.halfWidth.applyMatrix4(o),y.halfHeight.applyMatrix4(o),m++}else if(_.isPointLight){const y=n.point[f];y.position.setFromMatrixPosition(_.matrixWorld),y.position.applyMatrix4(p),f++}else if(_.isHemisphereLight){const y=n.hemi[v];y.direction.setFromMatrixPosition(_.matrixWorld),y.direction.transformDirection(p),v++}}}return{setup:a,setupView:c,state:n}}function jh(r){const t=new F1(r),e=[],n=[];function i(h){l.camera=h,e.length=0,n.length=0}function s(h){e.push(h)}function o(h){n.push(h)}function a(){t.setup(e)}function c(h){t.setupView(e,h)}const l={lightsArray:e,shadowsArray:n,camera:null,lights:t,transmissionRenderTarget:{}};return{init:i,state:l,setupLights:a,setupLightsView:c,pushLight:s,pushShadow:o}}function B1(r){let t=new WeakMap;function e(i,s=0){const o=t.get(i);let a;return o===void 0?(a=new jh(r),t.set(i,[a])):s>=o.length?(a=new jh(r),o.push(a)):a=o[s],a}function n(){t=new WeakMap}return{get:e,dispose:n}}class O1 extends Gi{constructor(t){super(),this.isMeshDepthMaterial=!0,this.type="MeshDepthMaterial",this.depthPacking=bd,this.map=null,this.alphaMap=null,this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.wireframe=!1,this.wireframeLinewidth=1,this.setValues(t)}copy(t){return super.copy(t),this.depthPacking=t.depthPacking,this.map=t.map,this.alphaMap=t.alphaMap,this.displacementMap=t.displacementMap,this.displacementScale=t.displacementScale,this.displacementBias=t.displacementBias,this.wireframe=t.wireframe,this.wireframeLinewidth=t.wireframeLinewidth,this}}class H1 extends Gi{constructor(t){super(),this.isMeshDistanceMaterial=!0,this.type="MeshDistanceMaterial",this.map=null,this.alphaMap=null,this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.setValues(t)}copy(t){return super.copy(t),this.map=t.map,this.alphaMap=t.alphaMap,this.displacementMap=t.displacementMap,this.displacementScale=t.displacementScale,this.displacementBias=t.displacementBias,this}}const V1=`void main() {
	gl_Position = vec4( position, 1.0 );
}`,G1=`uniform sampler2D shadow_pass;
uniform vec2 resolution;
uniform float radius;
#include <packing>
void main() {
	const float samples = float( VSM_SAMPLES );
	float mean = 0.0;
	float squared_mean = 0.0;
	float uvStride = samples <= 1.0 ? 0.0 : 2.0 / ( samples - 1.0 );
	float uvStart = samples <= 1.0 ? 0.0 : - 1.0;
	for ( float i = 0.0; i < samples; i ++ ) {
		float uvOffset = uvStart + i * uvStride;
		#ifdef HORIZONTAL_PASS
			vec2 distribution = unpackRGBATo2Half( texture2D( shadow_pass, ( gl_FragCoord.xy + vec2( uvOffset, 0.0 ) * radius ) / resolution ) );
			mean += distribution.x;
			squared_mean += distribution.y * distribution.y + distribution.x * distribution.x;
		#else
			float depth = unpackRGBAToDepth( texture2D( shadow_pass, ( gl_FragCoord.xy + vec2( 0.0, uvOffset ) * radius ) / resolution ) );
			mean += depth;
			squared_mean += depth * depth;
		#endif
	}
	mean = mean / samples;
	squared_mean = squared_mean / samples;
	float std_dev = sqrt( squared_mean - mean * mean );
	gl_FragColor = pack2HalfToRGBA( vec2( mean, std_dev ) );
}`;function W1(r,t,e){let n=new Sl;const i=new ct,s=new ct,o=new we,a=new O1({depthPacking:Sd}),c=new H1,l={},h=e.maxTextureSize,d={[Bi]:sn,[sn]:Bi,[cn]:cn},f=new Ye({defines:{VSM_SAMPLES:8},uniforms:{shadow_pass:{value:null},resolution:{value:new ct},radius:{value:4}},vertexShader:V1,fragmentShader:G1}),u=f.clone();u.defines.HORIZONTAL_PASS=1;const m=new ge;m.setAttribute("position",new te(new Float32Array([-1,-1,.5,3,-1,.5,-1,3,.5]),3));const v=new Ht(m,f),p=this;this.enabled=!1,this.autoUpdate=!0,this.needsUpdate=!1,this.type=Gu;let g=this.type;this.render=function(T,R,E){if(p.enabled===!1||p.autoUpdate===!1&&p.needsUpdate===!1||T.length===0)return;const D=r.getRenderTarget(),M=r.getActiveCubeFace(),S=r.getActiveMipmapLevel(),k=r.state;k.setBlending(jn),k.buffers.color.setClear(1,1,1,1),k.buffers.depth.setTest(!0),k.setScissorTest(!1);const N=g!==li&&this.type===li,z=g===li&&this.type!==li;for(let H=0,L=T.length;H<L;H++){const V=T[H],O=V.shadow;if(O===void 0){console.warn("THREE.WebGLShadowMap:",V,"has no shadow.");continue}if(O.autoUpdate===!1&&O.needsUpdate===!1)continue;i.copy(O.mapSize);const P=O.getFrameExtents();if(i.multiply(P),s.copy(O.mapSize),(i.x>h||i.y>h)&&(i.x>h&&(s.x=Math.floor(h/P.x),i.x=s.x*P.x,O.mapSize.x=s.x),i.y>h&&(s.y=Math.floor(h/P.y),i.y=s.y*P.y,O.mapSize.y=s.y)),O.map===null||N===!0||z===!0){const G=this.type!==li?{minFilter:en,magFilter:en}:{};O.map!==null&&O.map.dispose(),O.map=new ei(i.x,i.y,G),O.map.texture.name=V.name+".shadowMap",O.camera.updateProjectionMatrix()}r.setRenderTarget(O.map),r.clear();const B=O.getViewportCount();for(let G=0;G<B;G++){const Q=O.getViewport(G);o.set(s.x*Q.x,s.y*Q.y,s.x*Q.z,s.y*Q.w),k.viewport(o),O.updateMatrices(V,G),n=O.getFrustum(),y(R,E,O.camera,V,this.type)}O.isPointLightShadow!==!0&&this.type===li&&x(O,E),O.needsUpdate=!1}g=this.type,p.needsUpdate=!1,r.setRenderTarget(D,M,S)};function x(T,R){const E=t.update(v);f.defines.VSM_SAMPLES!==T.blurSamples&&(f.defines.VSM_SAMPLES=T.blurSamples,u.defines.VSM_SAMPLES=T.blurSamples,f.needsUpdate=!0,u.needsUpdate=!0),T.mapPass===null&&(T.mapPass=new ei(i.x,i.y)),f.uniforms.shadow_pass.value=T.map.texture,f.uniforms.resolution.value=T.mapSize,f.uniforms.radius.value=T.radius,r.setRenderTarget(T.mapPass),r.clear(),r.renderBufferDirect(R,null,E,f,v,null),u.uniforms.shadow_pass.value=T.mapPass.texture,u.uniforms.resolution.value=T.mapSize,u.uniforms.radius.value=T.radius,r.setRenderTarget(T.map),r.clear(),r.renderBufferDirect(R,null,E,u,v,null)}function _(T,R,E,D){let M=null;const S=E.isPointLight===!0?T.customDistanceMaterial:T.customDepthMaterial;if(S!==void 0)M=S;else if(M=E.isPointLight===!0?c:a,r.localClippingEnabled&&R.clipShadows===!0&&Array.isArray(R.clippingPlanes)&&R.clippingPlanes.length!==0||R.displacementMap&&R.displacementScale!==0||R.alphaMap&&R.alphaTest>0||R.map&&R.alphaTest>0){const k=M.uuid,N=R.uuid;let z=l[k];z===void 0&&(z={},l[k]=z);let H=z[N];H===void 0&&(H=M.clone(),z[N]=H,R.addEventListener("dispose",w)),M=H}if(M.visible=R.visible,M.wireframe=R.wireframe,D===li?M.side=R.shadowSide!==null?R.shadowSide:R.side:M.side=R.shadowSide!==null?R.shadowSide:d[R.side],M.alphaMap=R.alphaMap,M.alphaTest=R.alphaTest,M.map=R.map,M.clipShadows=R.clipShadows,M.clippingPlanes=R.clippingPlanes,M.clipIntersection=R.clipIntersection,M.displacementMap=R.displacementMap,M.displacementScale=R.displacementScale,M.displacementBias=R.displacementBias,M.wireframeLinewidth=R.wireframeLinewidth,M.linewidth=R.linewidth,E.isPointLight===!0&&M.isMeshDistanceMaterial===!0){const k=r.properties.get(M);k.light=E}return M}function y(T,R,E,D,M){if(T.visible===!1)return;if(T.layers.test(R.layers)&&(T.isMesh||T.isLine||T.isPoints)&&(T.castShadow||T.receiveShadow&&M===li)&&(!T.frustumCulled||n.intersectsObject(T))){T.modelViewMatrix.multiplyMatrices(E.matrixWorldInverse,T.matrixWorld);const N=t.update(T),z=T.material;if(Array.isArray(z)){const H=N.groups;for(let L=0,V=H.length;L<V;L++){const O=H[L],P=z[O.materialIndex];if(P&&P.visible){const B=_(T,P,D,M);T.onBeforeShadow(r,T,R,E,N,B,O),r.renderBufferDirect(E,null,N,B,T,O),T.onAfterShadow(r,T,R,E,N,B,O)}}}else if(z.visible){const H=_(T,z,D,M);T.onBeforeShadow(r,T,R,E,N,H,null),r.renderBufferDirect(E,null,N,H,T,null),T.onAfterShadow(r,T,R,E,N,H,null)}}const k=T.children;for(let N=0,z=k.length;N<z;N++)y(k[N],R,E,D,M)}function w(T){T.target.removeEventListener("dispose",w);for(const E in l){const D=l[E],M=T.target.uuid;M in D&&(D[M].dispose(),delete D[M])}}}const q1={[vc]:xc,[_c]:bc,[yc]:Sc,[Bs]:Mc,[xc]:vc,[bc]:_c,[Sc]:yc,[Mc]:Bs};function X1(r){function t(){let W=!1;const St=new we;let tt=null;const at=new we(0,0,0,0);return{setMask:function(yt){tt!==yt&&!W&&(r.colorMask(yt,yt,yt,yt),tt=yt)},setLocked:function(yt){W=yt},setClear:function(yt,wt,ce,Ne,ln){ln===!0&&(yt*=Ne,wt*=Ne,ce*=Ne),St.set(yt,wt,ce,Ne),at.equals(St)===!1&&(r.clearColor(yt,wt,ce,Ne),at.copy(St))},reset:function(){W=!1,tt=null,at.set(-1,0,0,0)}}}function e(){let W=!1,St=!1,tt=null,at=null,yt=null;return{setReversed:function(wt){St=wt},setTest:function(wt){wt?rt(r.DEPTH_TEST):J(r.DEPTH_TEST)},setMask:function(wt){tt!==wt&&!W&&(r.depthMask(wt),tt=wt)},setFunc:function(wt){if(St&&(wt=q1[wt]),at!==wt){switch(wt){case vc:r.depthFunc(r.NEVER);break;case xc:r.depthFunc(r.ALWAYS);break;case _c:r.depthFunc(r.LESS);break;case Bs:r.depthFunc(r.LEQUAL);break;case yc:r.depthFunc(r.EQUAL);break;case Mc:r.depthFunc(r.GEQUAL);break;case bc:r.depthFunc(r.GREATER);break;case Sc:r.depthFunc(r.NOTEQUAL);break;default:r.depthFunc(r.LEQUAL)}at=wt}},setLocked:function(wt){W=wt},setClear:function(wt){yt!==wt&&(r.clearDepth(wt),yt=wt)},reset:function(){W=!1,tt=null,at=null,yt=null}}}function n(){let W=!1,St=null,tt=null,at=null,yt=null,wt=null,ce=null,Ne=null,ln=null;return{setTest:function(he){W||(he?rt(r.STENCIL_TEST):J(r.STENCIL_TEST))},setMask:function(he){St!==he&&!W&&(r.stencilMask(he),St=he)},setFunc:function(he,hn,ii){(tt!==he||at!==hn||yt!==ii)&&(r.stencilFunc(he,hn,ii),tt=he,at=hn,yt=ii)},setOp:function(he,hn,ii){(wt!==he||ce!==hn||Ne!==ii)&&(r.stencilOp(he,hn,ii),wt=he,ce=hn,Ne=ii)},setLocked:function(he){W=he},setClear:function(he){ln!==he&&(r.clearStencil(he),ln=he)},reset:function(){W=!1,St=null,tt=null,at=null,yt=null,wt=null,ce=null,Ne=null,ln=null}}}const i=new t,s=new e,o=new n,a=new WeakMap,c=new WeakMap;let l={},h={},d=new WeakMap,f=[],u=null,m=!1,v=null,p=null,g=null,x=null,_=null,y=null,w=null,T=new dt(0,0,0),R=0,E=!1,D=null,M=null,S=null,k=null,N=null;const z=r.getParameter(r.MAX_COMBINED_TEXTURE_IMAGE_UNITS);let H=!1,L=0;const V=r.getParameter(r.VERSION);V.indexOf("WebGL")!==-1?(L=parseFloat(/^WebGL (\d)/.exec(V)[1]),H=L>=1):V.indexOf("OpenGL ES")!==-1&&(L=parseFloat(/^OpenGL ES (\d)/.exec(V)[1]),H=L>=2);let O=null,P={};const B=r.getParameter(r.SCISSOR_BOX),G=r.getParameter(r.VIEWPORT),Q=new we().fromArray(B),ut=new we().fromArray(G);function X(W,St,tt,at){const yt=new Uint8Array(4),wt=r.createTexture();r.bindTexture(W,wt),r.texParameteri(W,r.TEXTURE_MIN_FILTER,r.NEAREST),r.texParameteri(W,r.TEXTURE_MAG_FILTER,r.NEAREST);for(let ce=0;ce<tt;ce++)W===r.TEXTURE_3D||W===r.TEXTURE_2D_ARRAY?r.texImage3D(St,0,r.RGBA,1,1,at,0,r.RGBA,r.UNSIGNED_BYTE,yt):r.texImage2D(St+ce,0,r.RGBA,1,1,0,r.RGBA,r.UNSIGNED_BYTE,yt);return wt}const Z={};Z[r.TEXTURE_2D]=X(r.TEXTURE_2D,r.TEXTURE_2D,1),Z[r.TEXTURE_CUBE_MAP]=X(r.TEXTURE_CUBE_MAP,r.TEXTURE_CUBE_MAP_POSITIVE_X,6),Z[r.TEXTURE_2D_ARRAY]=X(r.TEXTURE_2D_ARRAY,r.TEXTURE_2D_ARRAY,1,1),Z[r.TEXTURE_3D]=X(r.TEXTURE_3D,r.TEXTURE_3D,1,1),i.setClear(0,0,0,1),s.setClear(1),o.setClear(0),rt(r.DEPTH_TEST),s.setFunc(Bs),Lt(!1),vt(nh),rt(r.CULL_FACE),F(jn);function rt(W){l[W]!==!0&&(r.enable(W),l[W]=!0)}function J(W){l[W]!==!1&&(r.disable(W),l[W]=!1)}function ot(W,St){return h[W]!==St?(r.bindFramebuffer(W,St),h[W]=St,W===r.DRAW_FRAMEBUFFER&&(h[r.FRAMEBUFFER]=St),W===r.FRAMEBUFFER&&(h[r.DRAW_FRAMEBUFFER]=St),!0):!1}function lt(W,St){let tt=f,at=!1;if(W){tt=d.get(St),tt===void 0&&(tt=[],d.set(St,tt));const yt=W.textures;if(tt.length!==yt.length||tt[0]!==r.COLOR_ATTACHMENT0){for(let wt=0,ce=yt.length;wt<ce;wt++)tt[wt]=r.COLOR_ATTACHMENT0+wt;tt.length=yt.length,at=!0}}else tt[0]!==r.BACK&&(tt[0]=r.BACK,at=!0);at&&r.drawBuffers(tt)}function bt(W){return u!==W?(r.useProgram(W),u=W,!0):!1}const At={[Li]:r.FUNC_ADD,[td]:r.FUNC_SUBTRACT,[ed]:r.FUNC_REVERSE_SUBTRACT};At[nd]=r.MIN,At[id]=r.MAX;const st={[sd]:r.ZERO,[pc]:r.ONE,[rd]:r.SRC_COLOR,[mc]:r.SRC_ALPHA,[ud]:r.SRC_ALPHA_SATURATE,[ld]:r.DST_COLOR,[ad]:r.DST_ALPHA,[od]:r.ONE_MINUS_SRC_COLOR,[gc]:r.ONE_MINUS_SRC_ALPHA,[hd]:r.ONE_MINUS_DST_COLOR,[cd]:r.ONE_MINUS_DST_ALPHA,[dd]:r.CONSTANT_COLOR,[fd]:r.ONE_MINUS_CONSTANT_COLOR,[pd]:r.CONSTANT_ALPHA,[md]:r.ONE_MINUS_CONSTANT_ALPHA};function F(W,St,tt,at,yt,wt,ce,Ne,ln,he){if(W===jn){m===!0&&(J(r.BLEND),m=!1);return}if(m===!1&&(rt(r.BLEND),m=!0),W!==zo){if(W!==v||he!==E){if((p!==Li||_!==Li)&&(r.blendEquation(r.FUNC_ADD),p=Li,_=Li),he)switch(W){case ss:r.blendFuncSeparate(r.ONE,r.ONE_MINUS_SRC_ALPHA,r.ONE,r.ONE_MINUS_SRC_ALPHA);break;case Uo:r.blendFunc(r.ONE,r.ONE);break;case ih:r.blendFuncSeparate(r.ZERO,r.ONE_MINUS_SRC_COLOR,r.ZERO,r.ONE);break;case sh:r.blendFuncSeparate(r.ZERO,r.SRC_COLOR,r.ZERO,r.SRC_ALPHA);break;default:console.error("THREE.WebGLState: Invalid blending: ",W);break}else switch(W){case ss:r.blendFuncSeparate(r.SRC_ALPHA,r.ONE_MINUS_SRC_ALPHA,r.ONE,r.ONE_MINUS_SRC_ALPHA);break;case Uo:r.blendFunc(r.SRC_ALPHA,r.ONE);break;case ih:r.blendFuncSeparate(r.ZERO,r.ONE_MINUS_SRC_COLOR,r.ZERO,r.ONE);break;case sh:r.blendFunc(r.ZERO,r.SRC_COLOR);break;default:console.error("THREE.WebGLState: Invalid blending: ",W);break}g=null,x=null,y=null,w=null,T.set(0,0,0),R=0,v=W,E=he}return}yt=yt||St,wt=wt||tt,ce=ce||at,(St!==p||yt!==_)&&(r.blendEquationSeparate(At[St],At[yt]),p=St,_=yt),(tt!==g||at!==x||wt!==y||ce!==w)&&(r.blendFuncSeparate(st[tt],st[at],st[wt],st[ce]),g=tt,x=at,y=wt,w=ce),(Ne.equals(T)===!1||ln!==R)&&(r.blendColor(Ne.r,Ne.g,Ne.b,ln),T.copy(Ne),R=ln),v=W,E=!1}function Gt(W,St){W.side===cn?J(r.CULL_FACE):rt(r.CULL_FACE);let tt=W.side===sn;St&&(tt=!tt),Lt(tt),W.blending===ss&&W.transparent===!1?F(jn):F(W.blending,W.blendEquation,W.blendSrc,W.blendDst,W.blendEquationAlpha,W.blendSrcAlpha,W.blendDstAlpha,W.blendColor,W.blendAlpha,W.premultipliedAlpha),s.setFunc(W.depthFunc),s.setTest(W.depthTest),s.setMask(W.depthWrite),i.setMask(W.colorWrite);const at=W.stencilWrite;o.setTest(at),at&&(o.setMask(W.stencilWriteMask),o.setFunc(W.stencilFunc,W.stencilRef,W.stencilFuncMask),o.setOp(W.stencilFail,W.stencilZFail,W.stencilZPass)),Kt(W.polygonOffset,W.polygonOffsetFactor,W.polygonOffsetUnits),W.alphaToCoverage===!0?rt(r.SAMPLE_ALPHA_TO_COVERAGE):J(r.SAMPLE_ALPHA_TO_COVERAGE)}function Lt(W){D!==W&&(W?r.frontFace(r.CW):r.frontFace(r.CCW),D=W)}function vt(W){W!==J0?(rt(r.CULL_FACE),W!==M&&(W===nh?r.cullFace(r.BACK):W===Q0?r.cullFace(r.FRONT):r.cullFace(r.FRONT_AND_BACK))):J(r.CULL_FACE),M=W}function ft(W){W!==S&&(H&&r.lineWidth(W),S=W)}function Kt(W,St,tt){W?(rt(r.POLYGON_OFFSET_FILL),(k!==St||N!==tt)&&(r.polygonOffset(St,tt),k=St,N=tt)):J(r.POLYGON_OFFSET_FILL)}function mt(W){W?rt(r.SCISSOR_TEST):J(r.SCISSOR_TEST)}function U(W){W===void 0&&(W=r.TEXTURE0+z-1),O!==W&&(r.activeTexture(W),O=W)}function C(W,St,tt){tt===void 0&&(O===null?tt=r.TEXTURE0+z-1:tt=O);let at=P[tt];at===void 0&&(at={type:void 0,texture:void 0},P[tt]=at),(at.type!==W||at.texture!==St)&&(O!==tt&&(r.activeTexture(tt),O=tt),r.bindTexture(W,St||Z[W]),at.type=W,at.texture=St)}function Y(){const W=P[O];W!==void 0&&W.type!==void 0&&(r.bindTexture(W.type,null),W.type=void 0,W.texture=void 0)}function nt(){try{r.compressedTexImage2D.apply(r,arguments)}catch(W){console.error("THREE.WebGLState:",W)}}function ht(){try{r.compressedTexImage3D.apply(r,arguments)}catch(W){console.error("THREE.WebGLState:",W)}}function it(){try{r.texSubImage2D.apply(r,arguments)}catch(W){console.error("THREE.WebGLState:",W)}}function Nt(){try{r.texSubImage3D.apply(r,arguments)}catch(W){console.error("THREE.WebGLState:",W)}}function _t(){try{r.compressedTexSubImage2D.apply(r,arguments)}catch(W){console.error("THREE.WebGLState:",W)}}function Tt(){try{r.compressedTexSubImage3D.apply(r,arguments)}catch(W){console.error("THREE.WebGLState:",W)}}function se(){try{r.texStorage2D.apply(r,arguments)}catch(W){console.error("THREE.WebGLState:",W)}}function pt(){try{r.texStorage3D.apply(r,arguments)}catch(W){console.error("THREE.WebGLState:",W)}}function Et(){try{r.texImage2D.apply(r,arguments)}catch(W){console.error("THREE.WebGLState:",W)}}function Ot(){try{r.texImage3D.apply(r,arguments)}catch(W){console.error("THREE.WebGLState:",W)}}function Wt(W){Q.equals(W)===!1&&(r.scissor(W.x,W.y,W.z,W.w),Q.copy(W))}function Rt(W){ut.equals(W)===!1&&(r.viewport(W.x,W.y,W.z,W.w),ut.copy(W))}function ae(W,St){let tt=c.get(St);tt===void 0&&(tt=new WeakMap,c.set(St,tt));let at=tt.get(W);at===void 0&&(at=r.getUniformBlockIndex(St,W.name),tt.set(W,at))}function Jt(W,St){const at=c.get(St).get(W);a.get(St)!==at&&(r.uniformBlockBinding(St,at,W.__bindingPointIndex),a.set(St,at))}function be(){r.disable(r.BLEND),r.disable(r.CULL_FACE),r.disable(r.DEPTH_TEST),r.disable(r.POLYGON_OFFSET_FILL),r.disable(r.SCISSOR_TEST),r.disable(r.STENCIL_TEST),r.disable(r.SAMPLE_ALPHA_TO_COVERAGE),r.blendEquation(r.FUNC_ADD),r.blendFunc(r.ONE,r.ZERO),r.blendFuncSeparate(r.ONE,r.ZERO,r.ONE,r.ZERO),r.blendColor(0,0,0,0),r.colorMask(!0,!0,!0,!0),r.clearColor(0,0,0,0),r.depthMask(!0),r.depthFunc(r.LESS),r.clearDepth(1),r.stencilMask(4294967295),r.stencilFunc(r.ALWAYS,0,4294967295),r.stencilOp(r.KEEP,r.KEEP,r.KEEP),r.clearStencil(0),r.cullFace(r.BACK),r.frontFace(r.CCW),r.polygonOffset(0,0),r.activeTexture(r.TEXTURE0),r.bindFramebuffer(r.FRAMEBUFFER,null),r.bindFramebuffer(r.DRAW_FRAMEBUFFER,null),r.bindFramebuffer(r.READ_FRAMEBUFFER,null),r.useProgram(null),r.lineWidth(1),r.scissor(0,0,r.canvas.width,r.canvas.height),r.viewport(0,0,r.canvas.width,r.canvas.height),l={},O=null,P={},h={},d=new WeakMap,f=[],u=null,m=!1,v=null,p=null,g=null,x=null,_=null,y=null,w=null,T=new dt(0,0,0),R=0,E=!1,D=null,M=null,S=null,k=null,N=null,Q.set(0,0,r.canvas.width,r.canvas.height),ut.set(0,0,r.canvas.width,r.canvas.height),i.reset(),s.reset(),o.reset()}return{buffers:{color:i,depth:s,stencil:o},enable:rt,disable:J,bindFramebuffer:ot,drawBuffers:lt,useProgram:bt,setBlending:F,setMaterial:Gt,setFlipSided:Lt,setCullFace:vt,setLineWidth:ft,setPolygonOffset:Kt,setScissorTest:mt,activeTexture:U,bindTexture:C,unbindTexture:Y,compressedTexImage2D:nt,compressedTexImage3D:ht,texImage2D:Et,texImage3D:Ot,updateUBOMapping:ae,uniformBlockBinding:Jt,texStorage2D:se,texStorage3D:pt,texSubImage2D:it,texSubImage3D:Nt,compressedTexSubImage2D:_t,compressedTexSubImage3D:Tt,scissor:Wt,viewport:Rt,reset:be}}function Yh(r,t,e,n){const i=j1(n);switch(e){case e0:return r*t;case i0:return r*t;case s0:return r*t*2;case ml:return r*t/i.components*i.byteLength;case gl:return r*t/i.components*i.byteLength;case vl:return r*t*2/i.components*i.byteLength;case xl:return r*t*2/i.components*i.byteLength;case n0:return r*t*3/i.components*i.byteLength;case Sn:return r*t*4/i.components*i.byteLength;case _l:return r*t*4/i.components*i.byteLength;case Ao:case Ro:return Math.floor((r+3)/4)*Math.floor((t+3)/4)*8;case Co:case Po:return Math.floor((r+3)/4)*Math.floor((t+3)/4)*16;case Rc:case Pc:return Math.max(r,16)*Math.max(t,8)/4;case Ac:case Cc:return Math.max(r,8)*Math.max(t,8)/2;case Lc:case kc:return Math.floor((r+3)/4)*Math.floor((t+3)/4)*8;case Dc:return Math.floor((r+3)/4)*Math.floor((t+3)/4)*16;case Ic:return Math.floor((r+3)/4)*Math.floor((t+3)/4)*16;case Nc:return Math.floor((r+4)/5)*Math.floor((t+3)/4)*16;case Uc:return Math.floor((r+4)/5)*Math.floor((t+4)/5)*16;case zc:return Math.floor((r+5)/6)*Math.floor((t+4)/5)*16;case Fc:return Math.floor((r+5)/6)*Math.floor((t+5)/6)*16;case Bc:return Math.floor((r+7)/8)*Math.floor((t+4)/5)*16;case Oc:return Math.floor((r+7)/8)*Math.floor((t+5)/6)*16;case Hc:return Math.floor((r+7)/8)*Math.floor((t+7)/8)*16;case Vc:return Math.floor((r+9)/10)*Math.floor((t+4)/5)*16;case Gc:return Math.floor((r+9)/10)*Math.floor((t+5)/6)*16;case Wc:return Math.floor((r+9)/10)*Math.floor((t+7)/8)*16;case qc:return Math.floor((r+9)/10)*Math.floor((t+9)/10)*16;case Xc:return Math.floor((r+11)/12)*Math.floor((t+9)/10)*16;case jc:return Math.floor((r+11)/12)*Math.floor((t+11)/12)*16;case Lo:case Yc:case $c:return Math.ceil(r/4)*Math.ceil(t/4)*16;case r0:case Kc:return Math.ceil(r/4)*Math.ceil(t/4)*8;case Zc:case Jc:return Math.ceil(r/4)*Math.ceil(t/4)*16}throw new Error(`Unable to determine texture byte length for ${e} format.`)}function j1(r){switch(r){case ti:case Ju:return{byteLength:1,components:1};case Cr:case Qu:case xi:return{byteLength:2,components:1};case fl:case pl:return{byteLength:2,components:4};case rs:case dl:case fn:return{byteLength:4,components:1};case t0:return{byteLength:4,components:3}}throw new Error(`Unknown texture type ${r}.`)}function Y1(r,t,e,n,i,s,o){const a=t.has("WEBGL_multisampled_render_to_texture")?t.get("WEBGL_multisampled_render_to_texture"):null,c=typeof navigator>"u"?!1:/OculusBrowser/g.test(navigator.userAgent),l=new ct,h=new WeakMap;let d;const f=new WeakMap;let u=!1;try{u=typeof OffscreenCanvas<"u"&&new OffscreenCanvas(1,1).getContext("2d")!==null}catch{}function m(U,C){return u?new OffscreenCanvas(U,C):Lr("canvas")}function v(U,C,Y){let nt=1;const ht=mt(U);if((ht.width>Y||ht.height>Y)&&(nt=Y/Math.max(ht.width,ht.height)),nt<1)if(typeof HTMLImageElement<"u"&&U instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&U instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&U instanceof ImageBitmap||typeof VideoFrame<"u"&&U instanceof VideoFrame){const it=Math.floor(nt*ht.width),Nt=Math.floor(nt*ht.height);d===void 0&&(d=m(it,Nt));const _t=C?m(it,Nt):d;return _t.width=it,_t.height=Nt,_t.getContext("2d").drawImage(U,0,0,it,Nt),console.warn("THREE.WebGLRenderer: Texture has been resized from ("+ht.width+"x"+ht.height+") to ("+it+"x"+Nt+")."),_t}else return"data"in U&&console.warn("THREE.WebGLRenderer: Image in DataTexture is too big ("+ht.width+"x"+ht.height+")."),U;return U}function p(U){return U.generateMipmaps&&U.minFilter!==en&&U.minFilter!==bn}function g(U){r.generateMipmap(U)}function x(U,C,Y,nt,ht=!1){if(U!==null){if(r[U]!==void 0)return r[U];console.warn("THREE.WebGLRenderer: Attempt to use non-existing WebGL internal format '"+U+"'")}let it=C;if(C===r.RED&&(Y===r.FLOAT&&(it=r.R32F),Y===r.HALF_FLOAT&&(it=r.R16F),Y===r.UNSIGNED_BYTE&&(it=r.R8)),C===r.RED_INTEGER&&(Y===r.UNSIGNED_BYTE&&(it=r.R8UI),Y===r.UNSIGNED_SHORT&&(it=r.R16UI),Y===r.UNSIGNED_INT&&(it=r.R32UI),Y===r.BYTE&&(it=r.R8I),Y===r.SHORT&&(it=r.R16I),Y===r.INT&&(it=r.R32I)),C===r.RG&&(Y===r.FLOAT&&(it=r.RG32F),Y===r.HALF_FLOAT&&(it=r.RG16F),Y===r.UNSIGNED_BYTE&&(it=r.RG8)),C===r.RG_INTEGER&&(Y===r.UNSIGNED_BYTE&&(it=r.RG8UI),Y===r.UNSIGNED_SHORT&&(it=r.RG16UI),Y===r.UNSIGNED_INT&&(it=r.RG32UI),Y===r.BYTE&&(it=r.RG8I),Y===r.SHORT&&(it=r.RG16I),Y===r.INT&&(it=r.RG32I)),C===r.RGB_INTEGER&&(Y===r.UNSIGNED_BYTE&&(it=r.RGB8UI),Y===r.UNSIGNED_SHORT&&(it=r.RGB16UI),Y===r.UNSIGNED_INT&&(it=r.RGB32UI),Y===r.BYTE&&(it=r.RGB8I),Y===r.SHORT&&(it=r.RGB16I),Y===r.INT&&(it=r.RGB32I)),C===r.RGBA_INTEGER&&(Y===r.UNSIGNED_BYTE&&(it=r.RGBA8UI),Y===r.UNSIGNED_SHORT&&(it=r.RGBA16UI),Y===r.UNSIGNED_INT&&(it=r.RGBA32UI),Y===r.BYTE&&(it=r.RGBA8I),Y===r.SHORT&&(it=r.RGBA16I),Y===r.INT&&(it=r.RGBA32I)),C===r.RGB&&Y===r.UNSIGNED_INT_5_9_9_9_REV&&(it=r.RGB9_E5),C===r.RGBA){const Nt=ht?Bo:me.getTransfer(nt);Y===r.FLOAT&&(it=r.RGBA32F),Y===r.HALF_FLOAT&&(it=r.RGBA16F),Y===r.UNSIGNED_BYTE&&(it=Nt===Ee?r.SRGB8_ALPHA8:r.RGBA8),Y===r.UNSIGNED_SHORT_4_4_4_4&&(it=r.RGBA4),Y===r.UNSIGNED_SHORT_5_5_5_1&&(it=r.RGB5_A1)}return(it===r.R16F||it===r.R32F||it===r.RG16F||it===r.RG32F||it===r.RGBA16F||it===r.RGBA32F)&&t.get("EXT_color_buffer_float"),it}function _(U,C){let Y;return U?C===null||C===rs||C===Vs?Y=r.DEPTH24_STENCIL8:C===fn?Y=r.DEPTH32F_STENCIL8:C===Cr&&(Y=r.DEPTH24_STENCIL8,console.warn("DepthTexture: 16 bit depth attachment is not supported with stencil. Using 24-bit attachment.")):C===null||C===rs||C===Vs?Y=r.DEPTH_COMPONENT24:C===fn?Y=r.DEPTH_COMPONENT32F:C===Cr&&(Y=r.DEPTH_COMPONENT16),Y}function y(U,C){return p(U)===!0||U.isFramebufferTexture&&U.minFilter!==en&&U.minFilter!==bn?Math.log2(Math.max(C.width,C.height))+1:U.mipmaps!==void 0&&U.mipmaps.length>0?U.mipmaps.length:U.isCompressedTexture&&Array.isArray(U.image)?C.mipmaps.length:1}function w(U){const C=U.target;C.removeEventListener("dispose",w),R(C),C.isVideoTexture&&h.delete(C)}function T(U){const C=U.target;C.removeEventListener("dispose",T),D(C)}function R(U){const C=n.get(U);if(C.__webglInit===void 0)return;const Y=U.source,nt=f.get(Y);if(nt){const ht=nt[C.__cacheKey];ht.usedTimes--,ht.usedTimes===0&&E(U),Object.keys(nt).length===0&&f.delete(Y)}n.remove(U)}function E(U){const C=n.get(U);r.deleteTexture(C.__webglTexture);const Y=U.source,nt=f.get(Y);delete nt[C.__cacheKey],o.memory.textures--}function D(U){const C=n.get(U);if(U.depthTexture&&U.depthTexture.dispose(),U.isWebGLCubeRenderTarget)for(let nt=0;nt<6;nt++){if(Array.isArray(C.__webglFramebuffer[nt]))for(let ht=0;ht<C.__webglFramebuffer[nt].length;ht++)r.deleteFramebuffer(C.__webglFramebuffer[nt][ht]);else r.deleteFramebuffer(C.__webglFramebuffer[nt]);C.__webglDepthbuffer&&r.deleteRenderbuffer(C.__webglDepthbuffer[nt])}else{if(Array.isArray(C.__webglFramebuffer))for(let nt=0;nt<C.__webglFramebuffer.length;nt++)r.deleteFramebuffer(C.__webglFramebuffer[nt]);else r.deleteFramebuffer(C.__webglFramebuffer);if(C.__webglDepthbuffer&&r.deleteRenderbuffer(C.__webglDepthbuffer),C.__webglMultisampledFramebuffer&&r.deleteFramebuffer(C.__webglMultisampledFramebuffer),C.__webglColorRenderbuffer)for(let nt=0;nt<C.__webglColorRenderbuffer.length;nt++)C.__webglColorRenderbuffer[nt]&&r.deleteRenderbuffer(C.__webglColorRenderbuffer[nt]);C.__webglDepthRenderbuffer&&r.deleteRenderbuffer(C.__webglDepthRenderbuffer)}const Y=U.textures;for(let nt=0,ht=Y.length;nt<ht;nt++){const it=n.get(Y[nt]);it.__webglTexture&&(r.deleteTexture(it.__webglTexture),o.memory.textures--),n.remove(Y[nt])}n.remove(U)}let M=0;function S(){M=0}function k(){const U=M;return U>=i.maxTextures&&console.warn("THREE.WebGLTextures: Trying to use "+U+" texture units while this GPU supports only "+i.maxTextures),M+=1,U}function N(U){const C=[];return C.push(U.wrapS),C.push(U.wrapT),C.push(U.wrapR||0),C.push(U.magFilter),C.push(U.minFilter),C.push(U.anisotropy),C.push(U.internalFormat),C.push(U.format),C.push(U.type),C.push(U.generateMipmaps),C.push(U.premultiplyAlpha),C.push(U.flipY),C.push(U.unpackAlignment),C.push(U.colorSpace),C.join()}function z(U,C){const Y=n.get(U);if(U.isVideoTexture&&ft(U),U.isRenderTargetTexture===!1&&U.version>0&&Y.__version!==U.version){const nt=U.image;if(nt===null)console.warn("THREE.WebGLRenderer: Texture marked for update but no image data found.");else if(nt.complete===!1)console.warn("THREE.WebGLRenderer: Texture marked for update but image is incomplete");else{ut(Y,U,C);return}}e.bindTexture(r.TEXTURE_2D,Y.__webglTexture,r.TEXTURE0+C)}function H(U,C){const Y=n.get(U);if(U.version>0&&Y.__version!==U.version){ut(Y,U,C);return}e.bindTexture(r.TEXTURE_2D_ARRAY,Y.__webglTexture,r.TEXTURE0+C)}function L(U,C){const Y=n.get(U);if(U.version>0&&Y.__version!==U.version){ut(Y,U,C);return}e.bindTexture(r.TEXTURE_3D,Y.__webglTexture,r.TEXTURE0+C)}function V(U,C){const Y=n.get(U);if(U.version>0&&Y.__version!==U.version){X(Y,U,C);return}e.bindTexture(r.TEXTURE_CUBE_MAP,Y.__webglTexture,r.TEXTURE0+C)}const O={[Fo]:r.REPEAT,[is]:r.CLAMP_TO_EDGE,[Ec]:r.MIRRORED_REPEAT},P={[en]:r.NEAREST,[Md]:r.NEAREST_MIPMAP_NEAREST,[Fr]:r.NEAREST_MIPMAP_LINEAR,[bn]:r.LINEAR,[pa]:r.LINEAR_MIPMAP_NEAREST,[Di]:r.LINEAR_MIPMAP_LINEAR},B={[Td]:r.NEVER,[Ld]:r.ALWAYS,[Ed]:r.LESS,[a0]:r.LEQUAL,[Ad]:r.EQUAL,[Pd]:r.GEQUAL,[Rd]:r.GREATER,[Cd]:r.NOTEQUAL};function G(U,C){if(C.type===fn&&t.has("OES_texture_float_linear")===!1&&(C.magFilter===bn||C.magFilter===pa||C.magFilter===Fr||C.magFilter===Di||C.minFilter===bn||C.minFilter===pa||C.minFilter===Fr||C.minFilter===Di)&&console.warn("THREE.WebGLRenderer: Unable to use linear filtering with floating point textures. OES_texture_float_linear not supported on this device."),r.texParameteri(U,r.TEXTURE_WRAP_S,O[C.wrapS]),r.texParameteri(U,r.TEXTURE_WRAP_T,O[C.wrapT]),(U===r.TEXTURE_3D||U===r.TEXTURE_2D_ARRAY)&&r.texParameteri(U,r.TEXTURE_WRAP_R,O[C.wrapR]),r.texParameteri(U,r.TEXTURE_MAG_FILTER,P[C.magFilter]),r.texParameteri(U,r.TEXTURE_MIN_FILTER,P[C.minFilter]),C.compareFunction&&(r.texParameteri(U,r.TEXTURE_COMPARE_MODE,r.COMPARE_REF_TO_TEXTURE),r.texParameteri(U,r.TEXTURE_COMPARE_FUNC,B[C.compareFunction])),t.has("EXT_texture_filter_anisotropic")===!0){if(C.magFilter===en||C.minFilter!==Fr&&C.minFilter!==Di||C.type===fn&&t.has("OES_texture_float_linear")===!1)return;if(C.anisotropy>1||n.get(C).__currentAnisotropy){const Y=t.get("EXT_texture_filter_anisotropic");r.texParameterf(U,Y.TEXTURE_MAX_ANISOTROPY_EXT,Math.min(C.anisotropy,i.getMaxAnisotropy())),n.get(C).__currentAnisotropy=C.anisotropy}}}function Q(U,C){let Y=!1;U.__webglInit===void 0&&(U.__webglInit=!0,C.addEventListener("dispose",w));const nt=C.source;let ht=f.get(nt);ht===void 0&&(ht={},f.set(nt,ht));const it=N(C);if(it!==U.__cacheKey){ht[it]===void 0&&(ht[it]={texture:r.createTexture(),usedTimes:0},o.memory.textures++,Y=!0),ht[it].usedTimes++;const Nt=ht[U.__cacheKey];Nt!==void 0&&(ht[U.__cacheKey].usedTimes--,Nt.usedTimes===0&&E(C)),U.__cacheKey=it,U.__webglTexture=ht[it].texture}return Y}function ut(U,C,Y){let nt=r.TEXTURE_2D;(C.isDataArrayTexture||C.isCompressedArrayTexture)&&(nt=r.TEXTURE_2D_ARRAY),C.isData3DTexture&&(nt=r.TEXTURE_3D);const ht=Q(U,C),it=C.source;e.bindTexture(nt,U.__webglTexture,r.TEXTURE0+Y);const Nt=n.get(it);if(it.version!==Nt.__version||ht===!0){e.activeTexture(r.TEXTURE0+Y);const _t=me.getPrimaries(me.workingColorSpace),Tt=C.colorSpace===ui?null:me.getPrimaries(C.colorSpace),se=C.colorSpace===ui||_t===Tt?r.NONE:r.BROWSER_DEFAULT_WEBGL;r.pixelStorei(r.UNPACK_FLIP_Y_WEBGL,C.flipY),r.pixelStorei(r.UNPACK_PREMULTIPLY_ALPHA_WEBGL,C.premultiplyAlpha),r.pixelStorei(r.UNPACK_ALIGNMENT,C.unpackAlignment),r.pixelStorei(r.UNPACK_COLORSPACE_CONVERSION_WEBGL,se);let pt=v(C.image,!1,i.maxTextureSize);pt=Kt(C,pt);const Et=s.convert(C.format,C.colorSpace),Ot=s.convert(C.type);let Wt=x(C.internalFormat,Et,Ot,C.colorSpace,C.isVideoTexture);G(nt,C);let Rt;const ae=C.mipmaps,Jt=C.isVideoTexture!==!0,be=Nt.__version===void 0||ht===!0,W=it.dataReady,St=y(C,pt);if(C.isDepthTexture)Wt=_(C.format===Gs,C.type),be&&(Jt?e.texStorage2D(r.TEXTURE_2D,1,Wt,pt.width,pt.height):e.texImage2D(r.TEXTURE_2D,0,Wt,pt.width,pt.height,0,Et,Ot,null));else if(C.isDataTexture)if(ae.length>0){Jt&&be&&e.texStorage2D(r.TEXTURE_2D,St,Wt,ae[0].width,ae[0].height);for(let tt=0,at=ae.length;tt<at;tt++)Rt=ae[tt],Jt?W&&e.texSubImage2D(r.TEXTURE_2D,tt,0,0,Rt.width,Rt.height,Et,Ot,Rt.data):e.texImage2D(r.TEXTURE_2D,tt,Wt,Rt.width,Rt.height,0,Et,Ot,Rt.data);C.generateMipmaps=!1}else Jt?(be&&e.texStorage2D(r.TEXTURE_2D,St,Wt,pt.width,pt.height),W&&e.texSubImage2D(r.TEXTURE_2D,0,0,0,pt.width,pt.height,Et,Ot,pt.data)):e.texImage2D(r.TEXTURE_2D,0,Wt,pt.width,pt.height,0,Et,Ot,pt.data);else if(C.isCompressedTexture)if(C.isCompressedArrayTexture){Jt&&be&&e.texStorage3D(r.TEXTURE_2D_ARRAY,St,Wt,ae[0].width,ae[0].height,pt.depth);for(let tt=0,at=ae.length;tt<at;tt++)if(Rt=ae[tt],C.format!==Sn)if(Et!==null)if(Jt){if(W)if(C.layerUpdates.size>0){const yt=Yh(Rt.width,Rt.height,C.format,C.type);for(const wt of C.layerUpdates){const ce=Rt.data.subarray(wt*yt/Rt.data.BYTES_PER_ELEMENT,(wt+1)*yt/Rt.data.BYTES_PER_ELEMENT);e.compressedTexSubImage3D(r.TEXTURE_2D_ARRAY,tt,0,0,wt,Rt.width,Rt.height,1,Et,ce,0,0)}C.clearLayerUpdates()}else e.compressedTexSubImage3D(r.TEXTURE_2D_ARRAY,tt,0,0,0,Rt.width,Rt.height,pt.depth,Et,Rt.data,0,0)}else e.compressedTexImage3D(r.TEXTURE_2D_ARRAY,tt,Wt,Rt.width,Rt.height,pt.depth,0,Rt.data,0,0);else console.warn("THREE.WebGLRenderer: Attempt to load unsupported compressed texture format in .uploadTexture()");else Jt?W&&e.texSubImage3D(r.TEXTURE_2D_ARRAY,tt,0,0,0,Rt.width,Rt.height,pt.depth,Et,Ot,Rt.data):e.texImage3D(r.TEXTURE_2D_ARRAY,tt,Wt,Rt.width,Rt.height,pt.depth,0,Et,Ot,Rt.data)}else{Jt&&be&&e.texStorage2D(r.TEXTURE_2D,St,Wt,ae[0].width,ae[0].height);for(let tt=0,at=ae.length;tt<at;tt++)Rt=ae[tt],C.format!==Sn?Et!==null?Jt?W&&e.compressedTexSubImage2D(r.TEXTURE_2D,tt,0,0,Rt.width,Rt.height,Et,Rt.data):e.compressedTexImage2D(r.TEXTURE_2D,tt,Wt,Rt.width,Rt.height,0,Rt.data):console.warn("THREE.WebGLRenderer: Attempt to load unsupported compressed texture format in .uploadTexture()"):Jt?W&&e.texSubImage2D(r.TEXTURE_2D,tt,0,0,Rt.width,Rt.height,Et,Ot,Rt.data):e.texImage2D(r.TEXTURE_2D,tt,Wt,Rt.width,Rt.height,0,Et,Ot,Rt.data)}else if(C.isDataArrayTexture)if(Jt){if(be&&e.texStorage3D(r.TEXTURE_2D_ARRAY,St,Wt,pt.width,pt.height,pt.depth),W)if(C.layerUpdates.size>0){const tt=Yh(pt.width,pt.height,C.format,C.type);for(const at of C.layerUpdates){const yt=pt.data.subarray(at*tt/pt.data.BYTES_PER_ELEMENT,(at+1)*tt/pt.data.BYTES_PER_ELEMENT);e.texSubImage3D(r.TEXTURE_2D_ARRAY,0,0,0,at,pt.width,pt.height,1,Et,Ot,yt)}C.clearLayerUpdates()}else e.texSubImage3D(r.TEXTURE_2D_ARRAY,0,0,0,0,pt.width,pt.height,pt.depth,Et,Ot,pt.data)}else e.texImage3D(r.TEXTURE_2D_ARRAY,0,Wt,pt.width,pt.height,pt.depth,0,Et,Ot,pt.data);else if(C.isData3DTexture)Jt?(be&&e.texStorage3D(r.TEXTURE_3D,St,Wt,pt.width,pt.height,pt.depth),W&&e.texSubImage3D(r.TEXTURE_3D,0,0,0,0,pt.width,pt.height,pt.depth,Et,Ot,pt.data)):e.texImage3D(r.TEXTURE_3D,0,Wt,pt.width,pt.height,pt.depth,0,Et,Ot,pt.data);else if(C.isFramebufferTexture){if(be)if(Jt)e.texStorage2D(r.TEXTURE_2D,St,Wt,pt.width,pt.height);else{let tt=pt.width,at=pt.height;for(let yt=0;yt<St;yt++)e.texImage2D(r.TEXTURE_2D,yt,Wt,tt,at,0,Et,Ot,null),tt>>=1,at>>=1}}else if(ae.length>0){if(Jt&&be){const tt=mt(ae[0]);e.texStorage2D(r.TEXTURE_2D,St,Wt,tt.width,tt.height)}for(let tt=0,at=ae.length;tt<at;tt++)Rt=ae[tt],Jt?W&&e.texSubImage2D(r.TEXTURE_2D,tt,0,0,Et,Ot,Rt):e.texImage2D(r.TEXTURE_2D,tt,Wt,Et,Ot,Rt);C.generateMipmaps=!1}else if(Jt){if(be){const tt=mt(pt);e.texStorage2D(r.TEXTURE_2D,St,Wt,tt.width,tt.height)}W&&e.texSubImage2D(r.TEXTURE_2D,0,0,0,Et,Ot,pt)}else e.texImage2D(r.TEXTURE_2D,0,Wt,Et,Ot,pt);p(C)&&g(nt),Nt.__version=it.version,C.onUpdate&&C.onUpdate(C)}U.__version=C.version}function X(U,C,Y){if(C.image.length!==6)return;const nt=Q(U,C),ht=C.source;e.bindTexture(r.TEXTURE_CUBE_MAP,U.__webglTexture,r.TEXTURE0+Y);const it=n.get(ht);if(ht.version!==it.__version||nt===!0){e.activeTexture(r.TEXTURE0+Y);const Nt=me.getPrimaries(me.workingColorSpace),_t=C.colorSpace===ui?null:me.getPrimaries(C.colorSpace),Tt=C.colorSpace===ui||Nt===_t?r.NONE:r.BROWSER_DEFAULT_WEBGL;r.pixelStorei(r.UNPACK_FLIP_Y_WEBGL,C.flipY),r.pixelStorei(r.UNPACK_PREMULTIPLY_ALPHA_WEBGL,C.premultiplyAlpha),r.pixelStorei(r.UNPACK_ALIGNMENT,C.unpackAlignment),r.pixelStorei(r.UNPACK_COLORSPACE_CONVERSION_WEBGL,Tt);const se=C.isCompressedTexture||C.image[0].isCompressedTexture,pt=C.image[0]&&C.image[0].isDataTexture,Et=[];for(let at=0;at<6;at++)!se&&!pt?Et[at]=v(C.image[at],!0,i.maxCubemapSize):Et[at]=pt?C.image[at].image:C.image[at],Et[at]=Kt(C,Et[at]);const Ot=Et[0],Wt=s.convert(C.format,C.colorSpace),Rt=s.convert(C.type),ae=x(C.internalFormat,Wt,Rt,C.colorSpace),Jt=C.isVideoTexture!==!0,be=it.__version===void 0||nt===!0,W=ht.dataReady;let St=y(C,Ot);G(r.TEXTURE_CUBE_MAP,C);let tt;if(se){Jt&&be&&e.texStorage2D(r.TEXTURE_CUBE_MAP,St,ae,Ot.width,Ot.height);for(let at=0;at<6;at++){tt=Et[at].mipmaps;for(let yt=0;yt<tt.length;yt++){const wt=tt[yt];C.format!==Sn?Wt!==null?Jt?W&&e.compressedTexSubImage2D(r.TEXTURE_CUBE_MAP_POSITIVE_X+at,yt,0,0,wt.width,wt.height,Wt,wt.data):e.compressedTexImage2D(r.TEXTURE_CUBE_MAP_POSITIVE_X+at,yt,ae,wt.width,wt.height,0,wt.data):console.warn("THREE.WebGLRenderer: Attempt to load unsupported compressed texture format in .setTextureCube()"):Jt?W&&e.texSubImage2D(r.TEXTURE_CUBE_MAP_POSITIVE_X+at,yt,0,0,wt.width,wt.height,Wt,Rt,wt.data):e.texImage2D(r.TEXTURE_CUBE_MAP_POSITIVE_X+at,yt,ae,wt.width,wt.height,0,Wt,Rt,wt.data)}}}else{if(tt=C.mipmaps,Jt&&be){tt.length>0&&St++;const at=mt(Et[0]);e.texStorage2D(r.TEXTURE_CUBE_MAP,St,ae,at.width,at.height)}for(let at=0;at<6;at++)if(pt){Jt?W&&e.texSubImage2D(r.TEXTURE_CUBE_MAP_POSITIVE_X+at,0,0,0,Et[at].width,Et[at].height,Wt,Rt,Et[at].data):e.texImage2D(r.TEXTURE_CUBE_MAP_POSITIVE_X+at,0,ae,Et[at].width,Et[at].height,0,Wt,Rt,Et[at].data);for(let yt=0;yt<tt.length;yt++){const ce=tt[yt].image[at].image;Jt?W&&e.texSubImage2D(r.TEXTURE_CUBE_MAP_POSITIVE_X+at,yt+1,0,0,ce.width,ce.height,Wt,Rt,ce.data):e.texImage2D(r.TEXTURE_CUBE_MAP_POSITIVE_X+at,yt+1,ae,ce.width,ce.height,0,Wt,Rt,ce.data)}}else{Jt?W&&e.texSubImage2D(r.TEXTURE_CUBE_MAP_POSITIVE_X+at,0,0,0,Wt,Rt,Et[at]):e.texImage2D(r.TEXTURE_CUBE_MAP_POSITIVE_X+at,0,ae,Wt,Rt,Et[at]);for(let yt=0;yt<tt.length;yt++){const wt=tt[yt];Jt?W&&e.texSubImage2D(r.TEXTURE_CUBE_MAP_POSITIVE_X+at,yt+1,0,0,Wt,Rt,wt.image[at]):e.texImage2D(r.TEXTURE_CUBE_MAP_POSITIVE_X+at,yt+1,ae,Wt,Rt,wt.image[at])}}}p(C)&&g(r.TEXTURE_CUBE_MAP),it.__version=ht.version,C.onUpdate&&C.onUpdate(C)}U.__version=C.version}function Z(U,C,Y,nt,ht,it){const Nt=s.convert(Y.format,Y.colorSpace),_t=s.convert(Y.type),Tt=x(Y.internalFormat,Nt,_t,Y.colorSpace);if(!n.get(C).__hasExternalTextures){const pt=Math.max(1,C.width>>it),Et=Math.max(1,C.height>>it);ht===r.TEXTURE_3D||ht===r.TEXTURE_2D_ARRAY?e.texImage3D(ht,it,Tt,pt,Et,C.depth,0,Nt,_t,null):e.texImage2D(ht,it,Tt,pt,Et,0,Nt,_t,null)}e.bindFramebuffer(r.FRAMEBUFFER,U),vt(C)?a.framebufferTexture2DMultisampleEXT(r.FRAMEBUFFER,nt,ht,n.get(Y).__webglTexture,0,Lt(C)):(ht===r.TEXTURE_2D||ht>=r.TEXTURE_CUBE_MAP_POSITIVE_X&&ht<=r.TEXTURE_CUBE_MAP_NEGATIVE_Z)&&r.framebufferTexture2D(r.FRAMEBUFFER,nt,ht,n.get(Y).__webglTexture,it),e.bindFramebuffer(r.FRAMEBUFFER,null)}function rt(U,C,Y){if(r.bindRenderbuffer(r.RENDERBUFFER,U),C.depthBuffer){const nt=C.depthTexture,ht=nt&&nt.isDepthTexture?nt.type:null,it=_(C.stencilBuffer,ht),Nt=C.stencilBuffer?r.DEPTH_STENCIL_ATTACHMENT:r.DEPTH_ATTACHMENT,_t=Lt(C);vt(C)?a.renderbufferStorageMultisampleEXT(r.RENDERBUFFER,_t,it,C.width,C.height):Y?r.renderbufferStorageMultisample(r.RENDERBUFFER,_t,it,C.width,C.height):r.renderbufferStorage(r.RENDERBUFFER,it,C.width,C.height),r.framebufferRenderbuffer(r.FRAMEBUFFER,Nt,r.RENDERBUFFER,U)}else{const nt=C.textures;for(let ht=0;ht<nt.length;ht++){const it=nt[ht],Nt=s.convert(it.format,it.colorSpace),_t=s.convert(it.type),Tt=x(it.internalFormat,Nt,_t,it.colorSpace),se=Lt(C);Y&&vt(C)===!1?r.renderbufferStorageMultisample(r.RENDERBUFFER,se,Tt,C.width,C.height):vt(C)?a.renderbufferStorageMultisampleEXT(r.RENDERBUFFER,se,Tt,C.width,C.height):r.renderbufferStorage(r.RENDERBUFFER,Tt,C.width,C.height)}}r.bindRenderbuffer(r.RENDERBUFFER,null)}function J(U,C){if(C&&C.isWebGLCubeRenderTarget)throw new Error("Depth Texture with cube render targets is not supported");if(e.bindFramebuffer(r.FRAMEBUFFER,U),!(C.depthTexture&&C.depthTexture.isDepthTexture))throw new Error("renderTarget.depthTexture must be an instance of THREE.DepthTexture");(!n.get(C.depthTexture).__webglTexture||C.depthTexture.image.width!==C.width||C.depthTexture.image.height!==C.height)&&(C.depthTexture.image.width=C.width,C.depthTexture.image.height=C.height,C.depthTexture.needsUpdate=!0),z(C.depthTexture,0);const nt=n.get(C.depthTexture).__webglTexture,ht=Lt(C);if(C.depthTexture.format===zi)vt(C)?a.framebufferTexture2DMultisampleEXT(r.FRAMEBUFFER,r.DEPTH_ATTACHMENT,r.TEXTURE_2D,nt,0,ht):r.framebufferTexture2D(r.FRAMEBUFFER,r.DEPTH_ATTACHMENT,r.TEXTURE_2D,nt,0);else if(C.depthTexture.format===Gs)vt(C)?a.framebufferTexture2DMultisampleEXT(r.FRAMEBUFFER,r.DEPTH_STENCIL_ATTACHMENT,r.TEXTURE_2D,nt,0,ht):r.framebufferTexture2D(r.FRAMEBUFFER,r.DEPTH_STENCIL_ATTACHMENT,r.TEXTURE_2D,nt,0);else throw new Error("Unknown depthTexture format")}function ot(U){const C=n.get(U),Y=U.isWebGLCubeRenderTarget===!0;if(C.__boundDepthTexture!==U.depthTexture){const nt=U.depthTexture;if(C.__depthDisposeCallback&&C.__depthDisposeCallback(),nt){const ht=()=>{delete C.__boundDepthTexture,delete C.__depthDisposeCallback,nt.removeEventListener("dispose",ht)};nt.addEventListener("dispose",ht),C.__depthDisposeCallback=ht}C.__boundDepthTexture=nt}if(U.depthTexture&&!C.__autoAllocateDepthBuffer){if(Y)throw new Error("target.depthTexture not supported in Cube render targets");J(C.__webglFramebuffer,U)}else if(Y){C.__webglDepthbuffer=[];for(let nt=0;nt<6;nt++)if(e.bindFramebuffer(r.FRAMEBUFFER,C.__webglFramebuffer[nt]),C.__webglDepthbuffer[nt]===void 0)C.__webglDepthbuffer[nt]=r.createRenderbuffer(),rt(C.__webglDepthbuffer[nt],U,!1);else{const ht=U.stencilBuffer?r.DEPTH_STENCIL_ATTACHMENT:r.DEPTH_ATTACHMENT,it=C.__webglDepthbuffer[nt];r.bindRenderbuffer(r.RENDERBUFFER,it),r.framebufferRenderbuffer(r.FRAMEBUFFER,ht,r.RENDERBUFFER,it)}}else if(e.bindFramebuffer(r.FRAMEBUFFER,C.__webglFramebuffer),C.__webglDepthbuffer===void 0)C.__webglDepthbuffer=r.createRenderbuffer(),rt(C.__webglDepthbuffer,U,!1);else{const nt=U.stencilBuffer?r.DEPTH_STENCIL_ATTACHMENT:r.DEPTH_ATTACHMENT,ht=C.__webglDepthbuffer;r.bindRenderbuffer(r.RENDERBUFFER,ht),r.framebufferRenderbuffer(r.FRAMEBUFFER,nt,r.RENDERBUFFER,ht)}e.bindFramebuffer(r.FRAMEBUFFER,null)}function lt(U,C,Y){const nt=n.get(U);C!==void 0&&Z(nt.__webglFramebuffer,U,U.texture,r.COLOR_ATTACHMENT0,r.TEXTURE_2D,0),Y!==void 0&&ot(U)}function bt(U){const C=U.texture,Y=n.get(U),nt=n.get(C);U.addEventListener("dispose",T);const ht=U.textures,it=U.isWebGLCubeRenderTarget===!0,Nt=ht.length>1;if(Nt||(nt.__webglTexture===void 0&&(nt.__webglTexture=r.createTexture()),nt.__version=C.version,o.memory.textures++),it){Y.__webglFramebuffer=[];for(let _t=0;_t<6;_t++)if(C.mipmaps&&C.mipmaps.length>0){Y.__webglFramebuffer[_t]=[];for(let Tt=0;Tt<C.mipmaps.length;Tt++)Y.__webglFramebuffer[_t][Tt]=r.createFramebuffer()}else Y.__webglFramebuffer[_t]=r.createFramebuffer()}else{if(C.mipmaps&&C.mipmaps.length>0){Y.__webglFramebuffer=[];for(let _t=0;_t<C.mipmaps.length;_t++)Y.__webglFramebuffer[_t]=r.createFramebuffer()}else Y.__webglFramebuffer=r.createFramebuffer();if(Nt)for(let _t=0,Tt=ht.length;_t<Tt;_t++){const se=n.get(ht[_t]);se.__webglTexture===void 0&&(se.__webglTexture=r.createTexture(),o.memory.textures++)}if(U.samples>0&&vt(U)===!1){Y.__webglMultisampledFramebuffer=r.createFramebuffer(),Y.__webglColorRenderbuffer=[],e.bindFramebuffer(r.FRAMEBUFFER,Y.__webglMultisampledFramebuffer);for(let _t=0;_t<ht.length;_t++){const Tt=ht[_t];Y.__webglColorRenderbuffer[_t]=r.createRenderbuffer(),r.bindRenderbuffer(r.RENDERBUFFER,Y.__webglColorRenderbuffer[_t]);const se=s.convert(Tt.format,Tt.colorSpace),pt=s.convert(Tt.type),Et=x(Tt.internalFormat,se,pt,Tt.colorSpace,U.isXRRenderTarget===!0),Ot=Lt(U);r.renderbufferStorageMultisample(r.RENDERBUFFER,Ot,Et,U.width,U.height),r.framebufferRenderbuffer(r.FRAMEBUFFER,r.COLOR_ATTACHMENT0+_t,r.RENDERBUFFER,Y.__webglColorRenderbuffer[_t])}r.bindRenderbuffer(r.RENDERBUFFER,null),U.depthBuffer&&(Y.__webglDepthRenderbuffer=r.createRenderbuffer(),rt(Y.__webglDepthRenderbuffer,U,!0)),e.bindFramebuffer(r.FRAMEBUFFER,null)}}if(it){e.bindTexture(r.TEXTURE_CUBE_MAP,nt.__webglTexture),G(r.TEXTURE_CUBE_MAP,C);for(let _t=0;_t<6;_t++)if(C.mipmaps&&C.mipmaps.length>0)for(let Tt=0;Tt<C.mipmaps.length;Tt++)Z(Y.__webglFramebuffer[_t][Tt],U,C,r.COLOR_ATTACHMENT0,r.TEXTURE_CUBE_MAP_POSITIVE_X+_t,Tt);else Z(Y.__webglFramebuffer[_t],U,C,r.COLOR_ATTACHMENT0,r.TEXTURE_CUBE_MAP_POSITIVE_X+_t,0);p(C)&&g(r.TEXTURE_CUBE_MAP),e.unbindTexture()}else if(Nt){for(let _t=0,Tt=ht.length;_t<Tt;_t++){const se=ht[_t],pt=n.get(se);e.bindTexture(r.TEXTURE_2D,pt.__webglTexture),G(r.TEXTURE_2D,se),Z(Y.__webglFramebuffer,U,se,r.COLOR_ATTACHMENT0+_t,r.TEXTURE_2D,0),p(se)&&g(r.TEXTURE_2D)}e.unbindTexture()}else{let _t=r.TEXTURE_2D;if((U.isWebGL3DRenderTarget||U.isWebGLArrayRenderTarget)&&(_t=U.isWebGL3DRenderTarget?r.TEXTURE_3D:r.TEXTURE_2D_ARRAY),e.bindTexture(_t,nt.__webglTexture),G(_t,C),C.mipmaps&&C.mipmaps.length>0)for(let Tt=0;Tt<C.mipmaps.length;Tt++)Z(Y.__webglFramebuffer[Tt],U,C,r.COLOR_ATTACHMENT0,_t,Tt);else Z(Y.__webglFramebuffer,U,C,r.COLOR_ATTACHMENT0,_t,0);p(C)&&g(_t),e.unbindTexture()}U.depthBuffer&&ot(U)}function At(U){const C=U.textures;for(let Y=0,nt=C.length;Y<nt;Y++){const ht=C[Y];if(p(ht)){const it=U.isWebGLCubeRenderTarget?r.TEXTURE_CUBE_MAP:r.TEXTURE_2D,Nt=n.get(ht).__webglTexture;e.bindTexture(it,Nt),g(it),e.unbindTexture()}}}const st=[],F=[];function Gt(U){if(U.samples>0){if(vt(U)===!1){const C=U.textures,Y=U.width,nt=U.height;let ht=r.COLOR_BUFFER_BIT;const it=U.stencilBuffer?r.DEPTH_STENCIL_ATTACHMENT:r.DEPTH_ATTACHMENT,Nt=n.get(U),_t=C.length>1;if(_t)for(let Tt=0;Tt<C.length;Tt++)e.bindFramebuffer(r.FRAMEBUFFER,Nt.__webglMultisampledFramebuffer),r.framebufferRenderbuffer(r.FRAMEBUFFER,r.COLOR_ATTACHMENT0+Tt,r.RENDERBUFFER,null),e.bindFramebuffer(r.FRAMEBUFFER,Nt.__webglFramebuffer),r.framebufferTexture2D(r.DRAW_FRAMEBUFFER,r.COLOR_ATTACHMENT0+Tt,r.TEXTURE_2D,null,0);e.bindFramebuffer(r.READ_FRAMEBUFFER,Nt.__webglMultisampledFramebuffer),e.bindFramebuffer(r.DRAW_FRAMEBUFFER,Nt.__webglFramebuffer);for(let Tt=0;Tt<C.length;Tt++){if(U.resolveDepthBuffer&&(U.depthBuffer&&(ht|=r.DEPTH_BUFFER_BIT),U.stencilBuffer&&U.resolveStencilBuffer&&(ht|=r.STENCIL_BUFFER_BIT)),_t){r.framebufferRenderbuffer(r.READ_FRAMEBUFFER,r.COLOR_ATTACHMENT0,r.RENDERBUFFER,Nt.__webglColorRenderbuffer[Tt]);const se=n.get(C[Tt]).__webglTexture;r.framebufferTexture2D(r.DRAW_FRAMEBUFFER,r.COLOR_ATTACHMENT0,r.TEXTURE_2D,se,0)}r.blitFramebuffer(0,0,Y,nt,0,0,Y,nt,ht,r.NEAREST),c===!0&&(st.length=0,F.length=0,st.push(r.COLOR_ATTACHMENT0+Tt),U.depthBuffer&&U.resolveDepthBuffer===!1&&(st.push(it),F.push(it),r.invalidateFramebuffer(r.DRAW_FRAMEBUFFER,F)),r.invalidateFramebuffer(r.READ_FRAMEBUFFER,st))}if(e.bindFramebuffer(r.READ_FRAMEBUFFER,null),e.bindFramebuffer(r.DRAW_FRAMEBUFFER,null),_t)for(let Tt=0;Tt<C.length;Tt++){e.bindFramebuffer(r.FRAMEBUFFER,Nt.__webglMultisampledFramebuffer),r.framebufferRenderbuffer(r.FRAMEBUFFER,r.COLOR_ATTACHMENT0+Tt,r.RENDERBUFFER,Nt.__webglColorRenderbuffer[Tt]);const se=n.get(C[Tt]).__webglTexture;e.bindFramebuffer(r.FRAMEBUFFER,Nt.__webglFramebuffer),r.framebufferTexture2D(r.DRAW_FRAMEBUFFER,r.COLOR_ATTACHMENT0+Tt,r.TEXTURE_2D,se,0)}e.bindFramebuffer(r.DRAW_FRAMEBUFFER,Nt.__webglMultisampledFramebuffer)}else if(U.depthBuffer&&U.resolveDepthBuffer===!1&&c){const C=U.stencilBuffer?r.DEPTH_STENCIL_ATTACHMENT:r.DEPTH_ATTACHMENT;r.invalidateFramebuffer(r.DRAW_FRAMEBUFFER,[C])}}}function Lt(U){return Math.min(i.maxSamples,U.samples)}function vt(U){const C=n.get(U);return U.samples>0&&t.has("WEBGL_multisampled_render_to_texture")===!0&&C.__useRenderToTexture!==!1}function ft(U){const C=o.render.frame;h.get(U)!==C&&(h.set(U,C),U.update())}function Kt(U,C){const Y=U.colorSpace,nt=U.format,ht=U.type;return U.isCompressedTexture===!0||U.isVideoTexture===!0||Y!==Hi&&Y!==ui&&(me.getTransfer(Y)===Ee?(nt!==Sn||ht!==ti)&&console.warn("THREE.WebGLTextures: sRGB encoded textures have to use RGBAFormat and UnsignedByteType."):console.error("THREE.WebGLTextures: Unsupported texture color space:",Y)),C}function mt(U){return typeof HTMLImageElement<"u"&&U instanceof HTMLImageElement?(l.width=U.naturalWidth||U.width,l.height=U.naturalHeight||U.height):typeof VideoFrame<"u"&&U instanceof VideoFrame?(l.width=U.displayWidth,l.height=U.displayHeight):(l.width=U.width,l.height=U.height),l}this.allocateTextureUnit=k,this.resetTextureUnits=S,this.setTexture2D=z,this.setTexture2DArray=H,this.setTexture3D=L,this.setTextureCube=V,this.rebindTextures=lt,this.setupRenderTarget=bt,this.updateRenderTargetMipmap=At,this.updateMultisampleRenderTarget=Gt,this.setupDepthRenderbuffer=ot,this.setupFrameBufferTexture=Z,this.useMultisampledRTT=vt}function $1(r,t){function e(n,i=ui){let s;const o=me.getTransfer(i);if(n===ti)return r.UNSIGNED_BYTE;if(n===fl)return r.UNSIGNED_SHORT_4_4_4_4;if(n===pl)return r.UNSIGNED_SHORT_5_5_5_1;if(n===t0)return r.UNSIGNED_INT_5_9_9_9_REV;if(n===Ju)return r.BYTE;if(n===Qu)return r.SHORT;if(n===Cr)return r.UNSIGNED_SHORT;if(n===dl)return r.INT;if(n===rs)return r.UNSIGNED_INT;if(n===fn)return r.FLOAT;if(n===xi)return r.HALF_FLOAT;if(n===e0)return r.ALPHA;if(n===n0)return r.RGB;if(n===Sn)return r.RGBA;if(n===i0)return r.LUMINANCE;if(n===s0)return r.LUMINANCE_ALPHA;if(n===zi)return r.DEPTH_COMPONENT;if(n===Gs)return r.DEPTH_STENCIL;if(n===ml)return r.RED;if(n===gl)return r.RED_INTEGER;if(n===vl)return r.RG;if(n===xl)return r.RG_INTEGER;if(n===_l)return r.RGBA_INTEGER;if(n===Ao||n===Ro||n===Co||n===Po)if(o===Ee)if(s=t.get("WEBGL_compressed_texture_s3tc_srgb"),s!==null){if(n===Ao)return s.COMPRESSED_SRGB_S3TC_DXT1_EXT;if(n===Ro)return s.COMPRESSED_SRGB_ALPHA_S3TC_DXT1_EXT;if(n===Co)return s.COMPRESSED_SRGB_ALPHA_S3TC_DXT3_EXT;if(n===Po)return s.COMPRESSED_SRGB_ALPHA_S3TC_DXT5_EXT}else return null;else if(s=t.get("WEBGL_compressed_texture_s3tc"),s!==null){if(n===Ao)return s.COMPRESSED_RGB_S3TC_DXT1_EXT;if(n===Ro)return s.COMPRESSED_RGBA_S3TC_DXT1_EXT;if(n===Co)return s.COMPRESSED_RGBA_S3TC_DXT3_EXT;if(n===Po)return s.COMPRESSED_RGBA_S3TC_DXT5_EXT}else return null;if(n===Ac||n===Rc||n===Cc||n===Pc)if(s=t.get("WEBGL_compressed_texture_pvrtc"),s!==null){if(n===Ac)return s.COMPRESSED_RGB_PVRTC_4BPPV1_IMG;if(n===Rc)return s.COMPRESSED_RGB_PVRTC_2BPPV1_IMG;if(n===Cc)return s.COMPRESSED_RGBA_PVRTC_4BPPV1_IMG;if(n===Pc)return s.COMPRESSED_RGBA_PVRTC_2BPPV1_IMG}else return null;if(n===Lc||n===kc||n===Dc)if(s=t.get("WEBGL_compressed_texture_etc"),s!==null){if(n===Lc||n===kc)return o===Ee?s.COMPRESSED_SRGB8_ETC2:s.COMPRESSED_RGB8_ETC2;if(n===Dc)return o===Ee?s.COMPRESSED_SRGB8_ALPHA8_ETC2_EAC:s.COMPRESSED_RGBA8_ETC2_EAC}else return null;if(n===Ic||n===Nc||n===Uc||n===zc||n===Fc||n===Bc||n===Oc||n===Hc||n===Vc||n===Gc||n===Wc||n===qc||n===Xc||n===jc)if(s=t.get("WEBGL_compressed_texture_astc"),s!==null){if(n===Ic)return o===Ee?s.COMPRESSED_SRGB8_ALPHA8_ASTC_4x4_KHR:s.COMPRESSED_RGBA_ASTC_4x4_KHR;if(n===Nc)return o===Ee?s.COMPRESSED_SRGB8_ALPHA8_ASTC_5x4_KHR:s.COMPRESSED_RGBA_ASTC_5x4_KHR;if(n===Uc)return o===Ee?s.COMPRESSED_SRGB8_ALPHA8_ASTC_5x5_KHR:s.COMPRESSED_RGBA_ASTC_5x5_KHR;if(n===zc)return o===Ee?s.COMPRESSED_SRGB8_ALPHA8_ASTC_6x5_KHR:s.COMPRESSED_RGBA_ASTC_6x5_KHR;if(n===Fc)return o===Ee?s.COMPRESSED_SRGB8_ALPHA8_ASTC_6x6_KHR:s.COMPRESSED_RGBA_ASTC_6x6_KHR;if(n===Bc)return o===Ee?s.COMPRESSED_SRGB8_ALPHA8_ASTC_8x5_KHR:s.COMPRESSED_RGBA_ASTC_8x5_KHR;if(n===Oc)return o===Ee?s.COMPRESSED_SRGB8_ALPHA8_ASTC_8x6_KHR:s.COMPRESSED_RGBA_ASTC_8x6_KHR;if(n===Hc)return o===Ee?s.COMPRESSED_SRGB8_ALPHA8_ASTC_8x8_KHR:s.COMPRESSED_RGBA_ASTC_8x8_KHR;if(n===Vc)return o===Ee?s.COMPRESSED_SRGB8_ALPHA8_ASTC_10x5_KHR:s.COMPRESSED_RGBA_ASTC_10x5_KHR;if(n===Gc)return o===Ee?s.COMPRESSED_SRGB8_ALPHA8_ASTC_10x6_KHR:s.COMPRESSED_RGBA_ASTC_10x6_KHR;if(n===Wc)return o===Ee?s.COMPRESSED_SRGB8_ALPHA8_ASTC_10x8_KHR:s.COMPRESSED_RGBA_ASTC_10x8_KHR;if(n===qc)return o===Ee?s.COMPRESSED_SRGB8_ALPHA8_ASTC_10x10_KHR:s.COMPRESSED_RGBA_ASTC_10x10_KHR;if(n===Xc)return o===Ee?s.COMPRESSED_SRGB8_ALPHA8_ASTC_12x10_KHR:s.COMPRESSED_RGBA_ASTC_12x10_KHR;if(n===jc)return o===Ee?s.COMPRESSED_SRGB8_ALPHA8_ASTC_12x12_KHR:s.COMPRESSED_RGBA_ASTC_12x12_KHR}else return null;if(n===Lo||n===Yc||n===$c)if(s=t.get("EXT_texture_compression_bptc"),s!==null){if(n===Lo)return o===Ee?s.COMPRESSED_SRGB_ALPHA_BPTC_UNORM_EXT:s.COMPRESSED_RGBA_BPTC_UNORM_EXT;if(n===Yc)return s.COMPRESSED_RGB_BPTC_SIGNED_FLOAT_EXT;if(n===$c)return s.COMPRESSED_RGB_BPTC_UNSIGNED_FLOAT_EXT}else return null;if(n===r0||n===Kc||n===Zc||n===Jc)if(s=t.get("EXT_texture_compression_rgtc"),s!==null){if(n===Lo)return s.COMPRESSED_RED_RGTC1_EXT;if(n===Kc)return s.COMPRESSED_SIGNED_RED_RGTC1_EXT;if(n===Zc)return s.COMPRESSED_RED_GREEN_RGTC2_EXT;if(n===Jc)return s.COMPRESSED_SIGNED_RED_GREEN_RGTC2_EXT}else return null;return n===Vs?r.UNSIGNED_INT_24_8:r[n]!==void 0?r[n]:null}return{convert:e}}class K1 extends Cn{constructor(t=[]){super(),this.isArrayCamera=!0,this.cameras=t}}class Ie extends _e{constructor(){super(),this.isGroup=!0,this.type="Group"}}const Z1={type:"move"};class Va{constructor(){this._targetRay=null,this._grip=null,this._hand=null}getHandSpace(){return this._hand===null&&(this._hand=new Ie,this._hand.matrixAutoUpdate=!1,this._hand.visible=!1,this._hand.joints={},this._hand.inputState={pinching:!1}),this._hand}getTargetRaySpace(){return this._targetRay===null&&(this._targetRay=new Ie,this._targetRay.matrixAutoUpdate=!1,this._targetRay.visible=!1,this._targetRay.hasLinearVelocity=!1,this._targetRay.linearVelocity=new A,this._targetRay.hasAngularVelocity=!1,this._targetRay.angularVelocity=new A),this._targetRay}getGripSpace(){return this._grip===null&&(this._grip=new Ie,this._grip.matrixAutoUpdate=!1,this._grip.visible=!1,this._grip.hasLinearVelocity=!1,this._grip.linearVelocity=new A,this._grip.hasAngularVelocity=!1,this._grip.angularVelocity=new A),this._grip}dispatchEvent(t){return this._targetRay!==null&&this._targetRay.dispatchEvent(t),this._grip!==null&&this._grip.dispatchEvent(t),this._hand!==null&&this._hand.dispatchEvent(t),this}connect(t){if(t&&t.hand){const e=this._hand;if(e)for(const n of t.hand.values())this._getHandJoint(e,n)}return this.dispatchEvent({type:"connected",data:t}),this}disconnect(t){return this.dispatchEvent({type:"disconnected",data:t}),this._targetRay!==null&&(this._targetRay.visible=!1),this._grip!==null&&(this._grip.visible=!1),this._hand!==null&&(this._hand.visible=!1),this}update(t,e,n){let i=null,s=null,o=null;const a=this._targetRay,c=this._grip,l=this._hand;if(t&&e.session.visibilityState!=="visible-blurred"){if(l&&t.hand){o=!0;for(const v of t.hand.values()){const p=e.getJointPose(v,n),g=this._getHandJoint(l,v);p!==null&&(g.matrix.fromArray(p.transform.matrix),g.matrix.decompose(g.position,g.rotation,g.scale),g.matrixWorldNeedsUpdate=!0,g.jointRadius=p.radius),g.visible=p!==null}const h=l.joints["index-finger-tip"],d=l.joints["thumb-tip"],f=h.position.distanceTo(d.position),u=.02,m=.005;l.inputState.pinching&&f>u+m?(l.inputState.pinching=!1,this.dispatchEvent({type:"pinchend",handedness:t.handedness,target:this})):!l.inputState.pinching&&f<=u-m&&(l.inputState.pinching=!0,this.dispatchEvent({type:"pinchstart",handedness:t.handedness,target:this}))}else c!==null&&t.gripSpace&&(s=e.getPose(t.gripSpace,n),s!==null&&(c.matrix.fromArray(s.transform.matrix),c.matrix.decompose(c.position,c.rotation,c.scale),c.matrixWorldNeedsUpdate=!0,s.linearVelocity?(c.hasLinearVelocity=!0,c.linearVelocity.copy(s.linearVelocity)):c.hasLinearVelocity=!1,s.angularVelocity?(c.hasAngularVelocity=!0,c.angularVelocity.copy(s.angularVelocity)):c.hasAngularVelocity=!1));a!==null&&(i=e.getPose(t.targetRaySpace,n),i===null&&s!==null&&(i=s),i!==null&&(a.matrix.fromArray(i.transform.matrix),a.matrix.decompose(a.position,a.rotation,a.scale),a.matrixWorldNeedsUpdate=!0,i.linearVelocity?(a.hasLinearVelocity=!0,a.linearVelocity.copy(i.linearVelocity)):a.hasLinearVelocity=!1,i.angularVelocity?(a.hasAngularVelocity=!0,a.angularVelocity.copy(i.angularVelocity)):a.hasAngularVelocity=!1,this.dispatchEvent(Z1)))}return a!==null&&(a.visible=i!==null),c!==null&&(c.visible=s!==null),l!==null&&(l.visible=o!==null),this}_getHandJoint(t,e){if(t.joints[e.jointName]===void 0){const n=new Ie;n.matrixAutoUpdate=!1,n.visible=!1,t.joints[e.jointName]=n,t.add(n)}return t.joints[e.jointName]}}const J1=`
void main() {

	gl_Position = vec4( position, 1.0 );

}`,Q1=`
uniform sampler2DArray depthColor;
uniform float depthWidth;
uniform float depthHeight;

void main() {

	vec2 coord = vec2( gl_FragCoord.x / depthWidth, gl_FragCoord.y / depthHeight );

	if ( coord.x >= 1.0 ) {

		gl_FragDepth = texture( depthColor, vec3( coord.x - 1.0, coord.y, 1 ) ).r;

	} else {

		gl_FragDepth = texture( depthColor, vec3( coord.x, coord.y, 0 ) ).r;

	}

}`;class tv{constructor(){this.texture=null,this.mesh=null,this.depthNear=0,this.depthFar=0}init(t,e,n){if(this.texture===null){const i=new Ke,s=t.properties.get(i);s.__webglTexture=e.texture,(e.depthNear!=n.depthNear||e.depthFar!=n.depthFar)&&(this.depthNear=e.depthNear,this.depthFar=e.depthFar),this.texture=i}}getMesh(t){if(this.texture!==null&&this.mesh===null){const e=t.cameras[0].viewport,n=new Ye({vertexShader:J1,fragmentShader:Q1,uniforms:{depthColor:{value:this.texture},depthWidth:{value:e.z},depthHeight:{value:e.w}}});this.mesh=new Ht(new vi(20,20),n)}return this.mesh}reset(){this.texture=null,this.mesh=null}getDepthTexture(){return this.texture}}class ev extends Zs{constructor(t,e){super();const n=this;let i=null,s=1,o=null,a="local-floor",c=1,l=null,h=null,d=null,f=null,u=null,m=null;const v=new tv,p=e.getContextAttributes();let g=null,x=null;const _=[],y=[],w=new ct;let T=null;const R=new Cn;R.layers.enable(1),R.viewport=new we;const E=new Cn;E.layers.enable(2),E.viewport=new we;const D=[R,E],M=new K1;M.layers.enable(1),M.layers.enable(2);let S=null,k=null;this.cameraAutoUpdate=!0,this.enabled=!1,this.isPresenting=!1,this.getController=function(X){let Z=_[X];return Z===void 0&&(Z=new Va,_[X]=Z),Z.getTargetRaySpace()},this.getControllerGrip=function(X){let Z=_[X];return Z===void 0&&(Z=new Va,_[X]=Z),Z.getGripSpace()},this.getHand=function(X){let Z=_[X];return Z===void 0&&(Z=new Va,_[X]=Z),Z.getHandSpace()};function N(X){const Z=y.indexOf(X.inputSource);if(Z===-1)return;const rt=_[Z];rt!==void 0&&(rt.update(X.inputSource,X.frame,l||o),rt.dispatchEvent({type:X.type,data:X.inputSource}))}function z(){i.removeEventListener("select",N),i.removeEventListener("selectstart",N),i.removeEventListener("selectend",N),i.removeEventListener("squeeze",N),i.removeEventListener("squeezestart",N),i.removeEventListener("squeezeend",N),i.removeEventListener("end",z),i.removeEventListener("inputsourceschange",H);for(let X=0;X<_.length;X++){const Z=y[X];Z!==null&&(y[X]=null,_[X].disconnect(Z))}S=null,k=null,v.reset(),t.setRenderTarget(g),u=null,f=null,d=null,i=null,x=null,ut.stop(),n.isPresenting=!1,t.setPixelRatio(T),t.setSize(w.width,w.height,!1),n.dispatchEvent({type:"sessionend"})}this.setFramebufferScaleFactor=function(X){s=X,n.isPresenting===!0&&console.warn("THREE.WebXRManager: Cannot change framebuffer scale while presenting.")},this.setReferenceSpaceType=function(X){a=X,n.isPresenting===!0&&console.warn("THREE.WebXRManager: Cannot change reference space type while presenting.")},this.getReferenceSpace=function(){return l||o},this.setReferenceSpace=function(X){l=X},this.getBaseLayer=function(){return f!==null?f:u},this.getBinding=function(){return d},this.getFrame=function(){return m},this.getSession=function(){return i},this.setSession=async function(X){if(i=X,i!==null){if(g=t.getRenderTarget(),i.addEventListener("select",N),i.addEventListener("selectstart",N),i.addEventListener("selectend",N),i.addEventListener("squeeze",N),i.addEventListener("squeezestart",N),i.addEventListener("squeezeend",N),i.addEventListener("end",z),i.addEventListener("inputsourceschange",H),p.xrCompatible!==!0&&await e.makeXRCompatible(),T=t.getPixelRatio(),t.getSize(w),i.renderState.layers===void 0){const Z={antialias:p.antialias,alpha:!0,depth:p.depth,stencil:p.stencil,framebufferScaleFactor:s};u=new XRWebGLLayer(i,e,Z),i.updateRenderState({baseLayer:u}),t.setPixelRatio(1),t.setSize(u.framebufferWidth,u.framebufferHeight,!1),x=new ei(u.framebufferWidth,u.framebufferHeight,{format:Sn,type:ti,colorSpace:t.outputColorSpace,stencilBuffer:p.stencil})}else{let Z=null,rt=null,J=null;p.depth&&(J=p.stencil?e.DEPTH24_STENCIL8:e.DEPTH_COMPONENT24,Z=p.stencil?Gs:zi,rt=p.stencil?Vs:rs);const ot={colorFormat:e.RGBA8,depthFormat:J,scaleFactor:s};d=new XRWebGLBinding(i,e),f=d.createProjectionLayer(ot),i.updateRenderState({layers:[f]}),t.setPixelRatio(1),t.setSize(f.textureWidth,f.textureHeight,!1),x=new ei(f.textureWidth,f.textureHeight,{format:Sn,type:ti,depthTexture:new Go(f.textureWidth,f.textureHeight,rt,void 0,void 0,void 0,void 0,void 0,void 0,Z),stencilBuffer:p.stencil,colorSpace:t.outputColorSpace,samples:p.antialias?4:0,resolveDepthBuffer:f.ignoreDepthValues===!1})}x.isXRRenderTarget=!0,this.setFoveation(c),l=null,o=await i.requestReferenceSpace(a),ut.setContext(i),ut.start(),n.isPresenting=!0,n.dispatchEvent({type:"sessionstart"})}},this.getEnvironmentBlendMode=function(){if(i!==null)return i.environmentBlendMode},this.getDepthTexture=function(){return v.getDepthTexture()};function H(X){for(let Z=0;Z<X.removed.length;Z++){const rt=X.removed[Z],J=y.indexOf(rt);J>=0&&(y[J]=null,_[J].disconnect(rt))}for(let Z=0;Z<X.added.length;Z++){const rt=X.added[Z];let J=y.indexOf(rt);if(J===-1){for(let lt=0;lt<_.length;lt++)if(lt>=y.length){y.push(rt),J=lt;break}else if(y[lt]===null){y[lt]=rt,J=lt;break}if(J===-1)break}const ot=_[J];ot&&ot.connect(rt)}}const L=new A,V=new A;function O(X,Z,rt){L.setFromMatrixPosition(Z.matrixWorld),V.setFromMatrixPosition(rt.matrixWorld);const J=L.distanceTo(V),ot=Z.projectionMatrix.elements,lt=rt.projectionMatrix.elements,bt=ot[14]/(ot[10]-1),At=ot[14]/(ot[10]+1),st=(ot[9]+1)/ot[5],F=(ot[9]-1)/ot[5],Gt=(ot[8]-1)/ot[0],Lt=(lt[8]+1)/lt[0],vt=bt*Gt,ft=bt*Lt,Kt=J/(-Gt+Lt),mt=Kt*-Gt;if(Z.matrixWorld.decompose(X.position,X.quaternion,X.scale),X.translateX(mt),X.translateZ(Kt),X.matrixWorld.compose(X.position,X.quaternion,X.scale),X.matrixWorldInverse.copy(X.matrixWorld).invert(),ot[10]===-1)X.projectionMatrix.copy(Z.projectionMatrix),X.projectionMatrixInverse.copy(Z.projectionMatrixInverse);else{const U=bt+Kt,C=At+Kt,Y=vt-mt,nt=ft+(J-mt),ht=st*At/C*U,it=F*At/C*U;X.projectionMatrix.makePerspective(Y,nt,ht,it,U,C),X.projectionMatrixInverse.copy(X.projectionMatrix).invert()}}function P(X,Z){Z===null?X.matrixWorld.copy(X.matrix):X.matrixWorld.multiplyMatrices(Z.matrixWorld,X.matrix),X.matrixWorldInverse.copy(X.matrixWorld).invert()}this.updateCamera=function(X){if(i===null)return;let Z=X.near,rt=X.far;v.texture!==null&&(v.depthNear>0&&(Z=v.depthNear),v.depthFar>0&&(rt=v.depthFar)),M.near=E.near=R.near=Z,M.far=E.far=R.far=rt,(S!==M.near||k!==M.far)&&(i.updateRenderState({depthNear:M.near,depthFar:M.far}),S=M.near,k=M.far);const J=X.parent,ot=M.cameras;P(M,J);for(let lt=0;lt<ot.length;lt++)P(ot[lt],J);ot.length===2?O(M,R,E):M.projectionMatrix.copy(R.projectionMatrix),B(X,M,J)};function B(X,Z,rt){rt===null?X.matrix.copy(Z.matrixWorld):(X.matrix.copy(rt.matrixWorld),X.matrix.invert(),X.matrix.multiply(Z.matrixWorld)),X.matrix.decompose(X.position,X.quaternion,X.scale),X.updateMatrixWorld(!0),X.projectionMatrix.copy(Z.projectionMatrix),X.projectionMatrixInverse.copy(Z.projectionMatrixInverse),X.isPerspectiveCamera&&(X.fov=Pr*2*Math.atan(1/X.projectionMatrix.elements[5]),X.zoom=1)}this.getCamera=function(){return M},this.getFoveation=function(){if(!(f===null&&u===null))return c},this.setFoveation=function(X){c=X,f!==null&&(f.fixedFoveation=X),u!==null&&u.fixedFoveation!==void 0&&(u.fixedFoveation=X)},this.hasDepthSensing=function(){return v.texture!==null},this.getDepthSensingMesh=function(){return v.getMesh(M)};let G=null;function Q(X,Z){if(h=Z.getViewerPose(l||o),m=Z,h!==null){const rt=h.views;u!==null&&(t.setRenderTargetFramebuffer(x,u.framebuffer),t.setRenderTarget(x));let J=!1;rt.length!==M.cameras.length&&(M.cameras.length=0,J=!0);for(let lt=0;lt<rt.length;lt++){const bt=rt[lt];let At=null;if(u!==null)At=u.getViewport(bt);else{const F=d.getViewSubImage(f,bt);At=F.viewport,lt===0&&(t.setRenderTargetTextures(x,F.colorTexture,f.ignoreDepthValues?void 0:F.depthStencilTexture),t.setRenderTarget(x))}let st=D[lt];st===void 0&&(st=new Cn,st.layers.enable(lt),st.viewport=new we,D[lt]=st),st.matrix.fromArray(bt.transform.matrix),st.matrix.decompose(st.position,st.quaternion,st.scale),st.projectionMatrix.fromArray(bt.projectionMatrix),st.projectionMatrixInverse.copy(st.projectionMatrix).invert(),st.viewport.set(At.x,At.y,At.width,At.height),lt===0&&(M.matrix.copy(st.matrix),M.matrix.decompose(M.position,M.quaternion,M.scale)),J===!0&&M.cameras.push(st)}const ot=i.enabledFeatures;if(ot&&ot.includes("depth-sensing")){const lt=d.getDepthInformation(rt[0]);lt&&lt.isValid&&lt.texture&&v.init(t,lt,i.renderState)}}for(let rt=0;rt<_.length;rt++){const J=y[rt],ot=_[rt];J!==null&&ot!==void 0&&ot.update(J,Z,l||o)}G&&G(X,Z),Z.detectedPlanes&&n.dispatchEvent({type:"planesdetected",data:Z}),m=null}const ut=new y0;ut.setAnimationLoop(Q),this.setAnimationLoop=function(X){G=X},this.dispose=function(){}}}const Zi=new Ve,nv=new Dt;function iv(r,t){function e(p,g){p.matrixAutoUpdate===!0&&p.updateMatrix(),g.value.copy(p.matrix)}function n(p,g){g.color.getRGB(p.fogColor.value,p0(r)),g.isFog?(p.fogNear.value=g.near,p.fogFar.value=g.far):g.isFogExp2&&(p.fogDensity.value=g.density)}function i(p,g,x,_,y){g.isMeshBasicMaterial||g.isMeshLambertMaterial?s(p,g):g.isMeshToonMaterial?(s(p,g),d(p,g)):g.isMeshPhongMaterial?(s(p,g),h(p,g)):g.isMeshStandardMaterial?(s(p,g),f(p,g),g.isMeshPhysicalMaterial&&u(p,g,y)):g.isMeshMatcapMaterial?(s(p,g),m(p,g)):g.isMeshDepthMaterial?s(p,g):g.isMeshDistanceMaterial?(s(p,g),v(p,g)):g.isMeshNormalMaterial?s(p,g):g.isLineBasicMaterial?(o(p,g),g.isLineDashedMaterial&&a(p,g)):g.isPointsMaterial?c(p,g,x,_):g.isSpriteMaterial?l(p,g):g.isShadowMaterial?(p.color.value.copy(g.color),p.opacity.value=g.opacity):g.isShaderMaterial&&(g.uniformsNeedUpdate=!1)}function s(p,g){p.opacity.value=g.opacity,g.color&&p.diffuse.value.copy(g.color),g.emissive&&p.emissive.value.copy(g.emissive).multiplyScalar(g.emissiveIntensity),g.map&&(p.map.value=g.map,e(g.map,p.mapTransform)),g.alphaMap&&(p.alphaMap.value=g.alphaMap,e(g.alphaMap,p.alphaMapTransform)),g.bumpMap&&(p.bumpMap.value=g.bumpMap,e(g.bumpMap,p.bumpMapTransform),p.bumpScale.value=g.bumpScale,g.side===sn&&(p.bumpScale.value*=-1)),g.normalMap&&(p.normalMap.value=g.normalMap,e(g.normalMap,p.normalMapTransform),p.normalScale.value.copy(g.normalScale),g.side===sn&&p.normalScale.value.negate()),g.displacementMap&&(p.displacementMap.value=g.displacementMap,e(g.displacementMap,p.displacementMapTransform),p.displacementScale.value=g.displacementScale,p.displacementBias.value=g.displacementBias),g.emissiveMap&&(p.emissiveMap.value=g.emissiveMap,e(g.emissiveMap,p.emissiveMapTransform)),g.specularMap&&(p.specularMap.value=g.specularMap,e(g.specularMap,p.specularMapTransform)),g.alphaTest>0&&(p.alphaTest.value=g.alphaTest);const x=t.get(g),_=x.envMap,y=x.envMapRotation;_&&(p.envMap.value=_,Zi.copy(y),Zi.x*=-1,Zi.y*=-1,Zi.z*=-1,_.isCubeTexture&&_.isRenderTargetTexture===!1&&(Zi.y*=-1,Zi.z*=-1),p.envMapRotation.value.setFromMatrix4(nv.makeRotationFromEuler(Zi)),p.flipEnvMap.value=_.isCubeTexture&&_.isRenderTargetTexture===!1?-1:1,p.reflectivity.value=g.reflectivity,p.ior.value=g.ior,p.refractionRatio.value=g.refractionRatio),g.lightMap&&(p.lightMap.value=g.lightMap,p.lightMapIntensity.value=g.lightMapIntensity,e(g.lightMap,p.lightMapTransform)),g.aoMap&&(p.aoMap.value=g.aoMap,p.aoMapIntensity.value=g.aoMapIntensity,e(g.aoMap,p.aoMapTransform))}function o(p,g){p.diffuse.value.copy(g.color),p.opacity.value=g.opacity,g.map&&(p.map.value=g.map,e(g.map,p.mapTransform))}function a(p,g){p.dashSize.value=g.dashSize,p.totalSize.value=g.dashSize+g.gapSize,p.scale.value=g.scale}function c(p,g,x,_){p.diffuse.value.copy(g.color),p.opacity.value=g.opacity,p.size.value=g.size*x,p.scale.value=_*.5,g.map&&(p.map.value=g.map,e(g.map,p.uvTransform)),g.alphaMap&&(p.alphaMap.value=g.alphaMap,e(g.alphaMap,p.alphaMapTransform)),g.alphaTest>0&&(p.alphaTest.value=g.alphaTest)}function l(p,g){p.diffuse.value.copy(g.color),p.opacity.value=g.opacity,p.rotation.value=g.rotation,g.map&&(p.map.value=g.map,e(g.map,p.mapTransform)),g.alphaMap&&(p.alphaMap.value=g.alphaMap,e(g.alphaMap,p.alphaMapTransform)),g.alphaTest>0&&(p.alphaTest.value=g.alphaTest)}function h(p,g){p.specular.value.copy(g.specular),p.shininess.value=Math.max(g.shininess,1e-4)}function d(p,g){g.gradientMap&&(p.gradientMap.value=g.gradientMap)}function f(p,g){p.metalness.value=g.metalness,g.metalnessMap&&(p.metalnessMap.value=g.metalnessMap,e(g.metalnessMap,p.metalnessMapTransform)),p.roughness.value=g.roughness,g.roughnessMap&&(p.roughnessMap.value=g.roughnessMap,e(g.roughnessMap,p.roughnessMapTransform)),g.envMap&&(p.envMapIntensity.value=g.envMapIntensity)}function u(p,g,x){p.ior.value=g.ior,g.sheen>0&&(p.sheenColor.value.copy(g.sheenColor).multiplyScalar(g.sheen),p.sheenRoughness.value=g.sheenRoughness,g.sheenColorMap&&(p.sheenColorMap.value=g.sheenColorMap,e(g.sheenColorMap,p.sheenColorMapTransform)),g.sheenRoughnessMap&&(p.sheenRoughnessMap.value=g.sheenRoughnessMap,e(g.sheenRoughnessMap,p.sheenRoughnessMapTransform))),g.clearcoat>0&&(p.clearcoat.value=g.clearcoat,p.clearcoatRoughness.value=g.clearcoatRoughness,g.clearcoatMap&&(p.clearcoatMap.value=g.clearcoatMap,e(g.clearcoatMap,p.clearcoatMapTransform)),g.clearcoatRoughnessMap&&(p.clearcoatRoughnessMap.value=g.clearcoatRoughnessMap,e(g.clearcoatRoughnessMap,p.clearcoatRoughnessMapTransform)),g.clearcoatNormalMap&&(p.clearcoatNormalMap.value=g.clearcoatNormalMap,e(g.clearcoatNormalMap,p.clearcoatNormalMapTransform),p.clearcoatNormalScale.value.copy(g.clearcoatNormalScale),g.side===sn&&p.clearcoatNormalScale.value.negate())),g.dispersion>0&&(p.dispersion.value=g.dispersion),g.iridescence>0&&(p.iridescence.value=g.iridescence,p.iridescenceIOR.value=g.iridescenceIOR,p.iridescenceThicknessMinimum.value=g.iridescenceThicknessRange[0],p.iridescenceThicknessMaximum.value=g.iridescenceThicknessRange[1],g.iridescenceMap&&(p.iridescenceMap.value=g.iridescenceMap,e(g.iridescenceMap,p.iridescenceMapTransform)),g.iridescenceThicknessMap&&(p.iridescenceThicknessMap.value=g.iridescenceThicknessMap,e(g.iridescenceThicknessMap,p.iridescenceThicknessMapTransform))),g.transmission>0&&(p.transmission.value=g.transmission,p.transmissionSamplerMap.value=x.texture,p.transmissionSamplerSize.value.set(x.width,x.height),g.transmissionMap&&(p.transmissionMap.value=g.transmissionMap,e(g.transmissionMap,p.transmissionMapTransform)),p.thickness.value=g.thickness,g.thicknessMap&&(p.thicknessMap.value=g.thicknessMap,e(g.thicknessMap,p.thicknessMapTransform)),p.attenuationDistance.value=g.attenuationDistance,p.attenuationColor.value.copy(g.attenuationColor)),g.anisotropy>0&&(p.anisotropyVector.value.set(g.anisotropy*Math.cos(g.anisotropyRotation),g.anisotropy*Math.sin(g.anisotropyRotation)),g.anisotropyMap&&(p.anisotropyMap.value=g.anisotropyMap,e(g.anisotropyMap,p.anisotropyMapTransform))),p.specularIntensity.value=g.specularIntensity,p.specularColor.value.copy(g.specularColor),g.specularColorMap&&(p.specularColorMap.value=g.specularColorMap,e(g.specularColorMap,p.specularColorMapTransform)),g.specularIntensityMap&&(p.specularIntensityMap.value=g.specularIntensityMap,e(g.specularIntensityMap,p.specularIntensityMapTransform))}function m(p,g){g.matcap&&(p.matcap.value=g.matcap)}function v(p,g){const x=t.get(g).light;p.referencePosition.value.setFromMatrixPosition(x.matrixWorld),p.nearDistance.value=x.shadow.camera.near,p.farDistance.value=x.shadow.camera.far}return{refreshFogUniforms:n,refreshMaterialUniforms:i}}function sv(r,t,e,n){let i={},s={},o=[];const a=r.getParameter(r.MAX_UNIFORM_BUFFER_BINDINGS);function c(x,_){const y=_.program;n.uniformBlockBinding(x,y)}function l(x,_){let y=i[x.id];y===void 0&&(m(x),y=h(x),i[x.id]=y,x.addEventListener("dispose",p));const w=_.program;n.updateUBOMapping(x,w);const T=t.render.frame;s[x.id]!==T&&(f(x),s[x.id]=T)}function h(x){const _=d();x.__bindingPointIndex=_;const y=r.createBuffer(),w=x.__size,T=x.usage;return r.bindBuffer(r.UNIFORM_BUFFER,y),r.bufferData(r.UNIFORM_BUFFER,w,T),r.bindBuffer(r.UNIFORM_BUFFER,null),r.bindBufferBase(r.UNIFORM_BUFFER,_,y),y}function d(){for(let x=0;x<a;x++)if(o.indexOf(x)===-1)return o.push(x),x;return console.error("THREE.WebGLRenderer: Maximum number of simultaneously usable uniforms groups reached."),0}function f(x){const _=i[x.id],y=x.uniforms,w=x.__cache;r.bindBuffer(r.UNIFORM_BUFFER,_);for(let T=0,R=y.length;T<R;T++){const E=Array.isArray(y[T])?y[T]:[y[T]];for(let D=0,M=E.length;D<M;D++){const S=E[D];if(u(S,T,D,w)===!0){const k=S.__offset,N=Array.isArray(S.value)?S.value:[S.value];let z=0;for(let H=0;H<N.length;H++){const L=N[H],V=v(L);typeof L=="number"||typeof L=="boolean"?(S.__data[0]=L,r.bufferSubData(r.UNIFORM_BUFFER,k+z,S.__data)):L.isMatrix3?(S.__data[0]=L.elements[0],S.__data[1]=L.elements[1],S.__data[2]=L.elements[2],S.__data[3]=0,S.__data[4]=L.elements[3],S.__data[5]=L.elements[4],S.__data[6]=L.elements[5],S.__data[7]=0,S.__data[8]=L.elements[6],S.__data[9]=L.elements[7],S.__data[10]=L.elements[8],S.__data[11]=0):(L.toArray(S.__data,z),z+=V.storage/Float32Array.BYTES_PER_ELEMENT)}r.bufferSubData(r.UNIFORM_BUFFER,k,S.__data)}}}r.bindBuffer(r.UNIFORM_BUFFER,null)}function u(x,_,y,w){const T=x.value,R=_+"_"+y;if(w[R]===void 0)return typeof T=="number"||typeof T=="boolean"?w[R]=T:w[R]=T.clone(),!0;{const E=w[R];if(typeof T=="number"||typeof T=="boolean"){if(E!==T)return w[R]=T,!0}else if(E.equals(T)===!1)return E.copy(T),!0}return!1}function m(x){const _=x.uniforms;let y=0;const w=16;for(let R=0,E=_.length;R<E;R++){const D=Array.isArray(_[R])?_[R]:[_[R]];for(let M=0,S=D.length;M<S;M++){const k=D[M],N=Array.isArray(k.value)?k.value:[k.value];for(let z=0,H=N.length;z<H;z++){const L=N[z],V=v(L),O=y%w,P=O%V.boundary,B=O+P;y+=P,B!==0&&w-B<V.storage&&(y+=w-B),k.__data=new Float32Array(V.storage/Float32Array.BYTES_PER_ELEMENT),k.__offset=y,y+=V.storage}}}const T=y%w;return T>0&&(y+=w-T),x.__size=y,x.__cache={},this}function v(x){const _={boundary:0,storage:0};return typeof x=="number"||typeof x=="boolean"?(_.boundary=4,_.storage=4):x.isVector2?(_.boundary=8,_.storage=8):x.isVector3||x.isColor?(_.boundary=16,_.storage=12):x.isVector4?(_.boundary=16,_.storage=16):x.isMatrix3?(_.boundary=48,_.storage=48):x.isMatrix4?(_.boundary=64,_.storage=64):x.isTexture?console.warn("THREE.WebGLRenderer: Texture samplers can not be part of an uniforms group."):console.warn("THREE.WebGLRenderer: Unsupported uniform value type.",x),_}function p(x){const _=x.target;_.removeEventListener("dispose",p);const y=o.indexOf(_.__bindingPointIndex);o.splice(y,1),r.deleteBuffer(i[_.id]),delete i[_.id],delete s[_.id]}function g(){for(const x in i)r.deleteBuffer(i[x]);o=[],i={},s={}}return{bind:c,update:l,dispose:g}}class rv{constructor(t={}){const{canvas:e=Yd(),context:n=null,depth:i=!0,stencil:s=!1,alpha:o=!1,antialias:a=!1,premultipliedAlpha:c=!0,preserveDrawingBuffer:l=!1,powerPreference:h="default",failIfMajorPerformanceCaveat:d=!1}=t;this.isWebGLRenderer=!0;let f;if(n!==null){if(typeof WebGLRenderingContext<"u"&&n instanceof WebGLRenderingContext)throw new Error("THREE.WebGLRenderer: WebGL 1 is not supported since r163.");f=n.getContextAttributes().alpha}else f=o;const u=new Uint32Array(4),m=new Int32Array(4);let v=null,p=null;const g=[],x=[];this.domElement=e,this.debug={checkShaderErrors:!0,onShaderError:null},this.autoClear=!0,this.autoClearColor=!0,this.autoClearDepth=!0,this.autoClearStencil=!0,this.sortObjects=!0,this.clippingPlanes=[],this.localClippingEnabled=!1,this._outputColorSpace=Mn,this.toneMapping=Yn,this.toneMappingExposure=1;const _=this;let y=!1,w=0,T=0,R=null,E=-1,D=null;const M=new we,S=new we;let k=null;const N=new dt(0);let z=0,H=e.width,L=e.height,V=1,O=null,P=null;const B=new we(0,0,H,L),G=new we(0,0,H,L);let Q=!1;const ut=new Sl;let X=!1,Z=!1;const rt=new Dt,J=new Dt,ot=new A,lt=new we,bt={background:null,fog:null,environment:null,overrideMaterial:null,isScene:!0};let At=!1;function st(){return R===null?V:1}let F=n;function Gt(I,q){return e.getContext(I,q)}try{const I={alpha:!0,depth:i,stencil:s,antialias:a,premultipliedAlpha:c,preserveDrawingBuffer:l,powerPreference:h,failIfMajorPerformanceCaveat:d};if("setAttribute"in e&&e.setAttribute("data-engine",`three.js r${ul}`),e.addEventListener("webglcontextlost",at,!1),e.addEventListener("webglcontextrestored",yt,!1),e.addEventListener("webglcontextcreationerror",wt,!1),F===null){const q="webgl2";if(F=Gt(q,I),F===null)throw Gt(q)?new Error("Error creating WebGL context with your selected attributes."):new Error("Error creating WebGL context.")}}catch(I){throw console.error("THREE.WebGLRenderer: "+I.message),I}let Lt,vt,ft,Kt,mt,U,C,Y,nt,ht,it,Nt,_t,Tt,se,pt,Et,Ot,Wt,Rt,ae,Jt,be,W;function St(){Lt=new hg(F),Lt.init(),Jt=new $1(F,Lt),vt=new sg(F,Lt,t,Jt),ft=new X1(F),vt.reverseDepthBuffer&&ft.buffers.depth.setReversed(!0),Kt=new fg(F),mt=new L1,U=new Y1(F,Lt,ft,mt,vt,Jt,Kt),C=new og(_),Y=new lg(_),nt=new yf(F),be=new ng(F,nt),ht=new ug(F,nt,Kt,be),it=new mg(F,ht,nt,Kt),Wt=new pg(F,vt,U),pt=new rg(mt),Nt=new P1(_,C,Y,Lt,vt,be,pt),_t=new iv(_,mt),Tt=new D1,se=new B1(Lt),Ot=new eg(_,C,Y,ft,it,f,c),Et=new W1(_,it,vt),W=new sv(F,Kt,vt,ft),Rt=new ig(F,Lt,Kt),ae=new dg(F,Lt,Kt),Kt.programs=Nt.programs,_.capabilities=vt,_.extensions=Lt,_.properties=mt,_.renderLists=Tt,_.shadowMap=Et,_.state=ft,_.info=Kt}St();const tt=new ev(_,F);this.xr=tt,this.getContext=function(){return F},this.getContextAttributes=function(){return F.getContextAttributes()},this.forceContextLoss=function(){const I=Lt.get("WEBGL_lose_context");I&&I.loseContext()},this.forceContextRestore=function(){const I=Lt.get("WEBGL_lose_context");I&&I.restoreContext()},this.getPixelRatio=function(){return V},this.setPixelRatio=function(I){I!==void 0&&(V=I,this.setSize(H,L,!1))},this.getSize=function(I){return I.set(H,L)},this.setSize=function(I,q,$=!0){if(tt.isPresenting){console.warn("THREE.WebGLRenderer: Can't change size while VR device is presenting.");return}H=I,L=q,e.width=Math.floor(I*V),e.height=Math.floor(q*V),$===!0&&(e.style.width=I+"px",e.style.height=q+"px"),this.setViewport(0,0,I,q)},this.getDrawingBufferSize=function(I){return I.set(H*V,L*V).floor()},this.setDrawingBufferSize=function(I,q,$){H=I,L=q,V=$,e.width=Math.floor(I*$),e.height=Math.floor(q*$),this.setViewport(0,0,I,q)},this.getCurrentViewport=function(I){return I.copy(M)},this.getViewport=function(I){return I.copy(B)},this.setViewport=function(I,q,$,K){I.isVector4?B.set(I.x,I.y,I.z,I.w):B.set(I,q,$,K),ft.viewport(M.copy(B).multiplyScalar(V).round())},this.getScissor=function(I){return I.copy(G)},this.setScissor=function(I,q,$,K){I.isVector4?G.set(I.x,I.y,I.z,I.w):G.set(I,q,$,K),ft.scissor(S.copy(G).multiplyScalar(V).round())},this.getScissorTest=function(){return Q},this.setScissorTest=function(I){ft.setScissorTest(Q=I)},this.setOpaqueSort=function(I){O=I},this.setTransparentSort=function(I){P=I},this.getClearColor=function(I){return I.copy(Ot.getClearColor())},this.setClearColor=function(){Ot.setClearColor.apply(Ot,arguments)},this.getClearAlpha=function(){return Ot.getClearAlpha()},this.setClearAlpha=function(){Ot.setClearAlpha.apply(Ot,arguments)},this.clear=function(I=!0,q=!0,$=!0){let K=0;if(I){let j=!1;if(R!==null){const gt=R.texture.format;j=gt===_l||gt===xl||gt===gl}if(j){const gt=R.texture.type,Mt=gt===ti||gt===rs||gt===Cr||gt===Vs||gt===fl||gt===pl,kt=Ot.getClearColor(),It=Ot.getClearAlpha(),qt=kt.r,Yt=kt.g,zt=kt.b;Mt?(u[0]=qt,u[1]=Yt,u[2]=zt,u[3]=It,F.clearBufferuiv(F.COLOR,0,u)):(m[0]=qt,m[1]=Yt,m[2]=zt,m[3]=It,F.clearBufferiv(F.COLOR,0,m))}else K|=F.COLOR_BUFFER_BIT}q&&(K|=F.DEPTH_BUFFER_BIT,F.clearDepth(this.capabilities.reverseDepthBuffer?0:1)),$&&(K|=F.STENCIL_BUFFER_BIT,this.state.buffers.stencil.setMask(4294967295)),F.clear(K)},this.clearColor=function(){this.clear(!0,!1,!1)},this.clearDepth=function(){this.clear(!1,!0,!1)},this.clearStencil=function(){this.clear(!1,!1,!0)},this.dispose=function(){e.removeEventListener("webglcontextlost",at,!1),e.removeEventListener("webglcontextrestored",yt,!1),e.removeEventListener("webglcontextcreationerror",wt,!1),Tt.dispose(),se.dispose(),mt.dispose(),C.dispose(),Y.dispose(),it.dispose(),be.dispose(),W.dispose(),Nt.dispose(),tt.dispose(),tt.removeEventListener("sessionstart",Yl),tt.removeEventListener("sessionend",$l),qi.stop()};function at(I){I.preventDefault(),console.log("THREE.WebGLRenderer: Context Lost."),y=!0}function yt(){console.log("THREE.WebGLRenderer: Context Restored."),y=!1;const I=Kt.autoReset,q=Et.enabled,$=Et.autoUpdate,K=Et.needsUpdate,j=Et.type;St(),Kt.autoReset=I,Et.enabled=q,Et.autoUpdate=$,Et.needsUpdate=K,Et.type=j}function wt(I){console.error("THREE.WebGLRenderer: A WebGL context could not be created. Reason: ",I.statusMessage)}function ce(I){const q=I.target;q.removeEventListener("dispose",ce),Ne(q)}function Ne(I){ln(I),mt.remove(I)}function ln(I){const q=mt.get(I).programs;q!==void 0&&(q.forEach(function($){Nt.releaseProgram($)}),I.isShaderMaterial&&Nt.releaseShaderCache(I))}this.renderBufferDirect=function(I,q,$,K,j,gt){q===null&&(q=bt);const Mt=j.isMesh&&j.matrixWorld.determinant()<0,kt=X0(I,q,$,K,j);ft.setMaterial(K,Mt);let It=$.index,qt=1;if(K.wireframe===!0){if(It=ht.getWireframeAttribute($),It===void 0)return;qt=2}const Yt=$.drawRange,zt=$.attributes.position;let ve=Yt.start*qt,Te=(Yt.start+Yt.count)*qt;gt!==null&&(ve=Math.max(ve,gt.start*qt),Te=Math.min(Te,(gt.start+gt.count)*qt)),It!==null?(ve=Math.max(ve,0),Te=Math.min(Te,It.count)):zt!=null&&(ve=Math.max(ve,0),Te=Math.min(Te,zt.count));const Pe=Te-ve;if(Pe<0||Pe===1/0)return;be.setup(j,K,kt,$,It);let mn,fe=Rt;if(It!==null&&(mn=nt.get(It),fe=ae,fe.setIndex(mn)),j.isMesh)K.wireframe===!0?(ft.setLineWidth(K.wireframeLinewidth*st()),fe.setMode(F.LINES)):fe.setMode(F.TRIANGLES);else if(j.isLine){let Ft=K.linewidth;Ft===void 0&&(Ft=1),ft.setLineWidth(Ft*st()),j.isLineSegments?fe.setMode(F.LINES):j.isLineLoop?fe.setMode(F.LINE_LOOP):fe.setMode(F.LINE_STRIP)}else j.isPoints?fe.setMode(F.POINTS):j.isSprite&&fe.setMode(F.TRIANGLES);if(j.isBatchedMesh)if(j._multiDrawInstances!==null)fe.renderMultiDrawInstances(j._multiDrawStarts,j._multiDrawCounts,j._multiDrawCount,j._multiDrawInstances);else if(Lt.get("WEBGL_multi_draw"))fe.renderMultiDraw(j._multiDrawStarts,j._multiDrawCounts,j._multiDrawCount);else{const Ft=j._multiDrawStarts,$e=j._multiDrawCounts,pe=j._multiDrawCount,Dn=It?nt.get(It).bytesPerElement:1,as=mt.get(K).currentProgram.getUniforms();for(let gn=0;gn<pe;gn++)as.setValue(F,"_gl_DrawID",gn),fe.render(Ft[gn]/Dn,$e[gn])}else if(j.isInstancedMesh)fe.renderInstances(ve,Pe,j.count);else if($.isInstancedBufferGeometry){const Ft=$._maxInstanceCount!==void 0?$._maxInstanceCount:1/0,$e=Math.min($.instanceCount,Ft);fe.renderInstances(ve,Pe,$e)}else fe.render(ve,Pe)};function he(I,q,$){I.transparent===!0&&I.side===cn&&I.forceSinglePass===!1?(I.side=sn,I.needsUpdate=!0,zr(I,q,$),I.side=Bi,I.needsUpdate=!0,zr(I,q,$),I.side=cn):zr(I,q,$)}this.compile=function(I,q,$=null){$===null&&($=I),p=se.get($),p.init(q),x.push(p),$.traverseVisible(function(j){j.isLight&&j.layers.test(q.layers)&&(p.pushLight(j),j.castShadow&&p.pushShadow(j))}),I!==$&&I.traverseVisible(function(j){j.isLight&&j.layers.test(q.layers)&&(p.pushLight(j),j.castShadow&&p.pushShadow(j))}),p.setupLights();const K=new Set;return I.traverse(function(j){if(!(j.isMesh||j.isPoints||j.isLine||j.isSprite))return;const gt=j.material;if(gt)if(Array.isArray(gt))for(let Mt=0;Mt<gt.length;Mt++){const kt=gt[Mt];he(kt,$,j),K.add(kt)}else he(gt,$,j),K.add(gt)}),x.pop(),p=null,K},this.compileAsync=function(I,q,$=null){const K=this.compile(I,q,$);return new Promise(j=>{function gt(){if(K.forEach(function(Mt){mt.get(Mt).currentProgram.isReady()&&K.delete(Mt)}),K.size===0){j(I);return}setTimeout(gt,10)}Lt.get("KHR_parallel_shader_compile")!==null?gt():setTimeout(gt,10)})};let hn=null;function ii(I){hn&&hn(I)}function Yl(){qi.stop()}function $l(){qi.start()}const qi=new y0;qi.setAnimationLoop(ii),typeof self<"u"&&qi.setContext(self),this.setAnimationLoop=function(I){hn=I,tt.setAnimationLoop(I),I===null?qi.stop():qi.start()},tt.addEventListener("sessionstart",Yl),tt.addEventListener("sessionend",$l),this.render=function(I,q){if(q!==void 0&&q.isCamera!==!0){console.error("THREE.WebGLRenderer.render: camera is not an instance of THREE.Camera.");return}if(y===!0)return;if(I.matrixWorldAutoUpdate===!0&&I.updateMatrixWorld(),q.parent===null&&q.matrixWorldAutoUpdate===!0&&q.updateMatrixWorld(),tt.enabled===!0&&tt.isPresenting===!0&&(tt.cameraAutoUpdate===!0&&tt.updateCamera(q),q=tt.getCamera()),I.isScene===!0&&I.onBeforeRender(_,I,q,R),p=se.get(I,x.length),p.init(q),x.push(p),J.multiplyMatrices(q.projectionMatrix,q.matrixWorldInverse),ut.setFromProjectionMatrix(J),Z=this.localClippingEnabled,X=pt.init(this.clippingPlanes,Z),v=Tt.get(I,g.length),v.init(),g.push(v),tt.enabled===!0&&tt.isPresenting===!0){const gt=_.xr.getDepthSensingMesh();gt!==null&&ha(gt,q,-1/0,_.sortObjects)}ha(I,q,0,_.sortObjects),v.finish(),_.sortObjects===!0&&v.sort(O,P),At=tt.enabled===!1||tt.isPresenting===!1||tt.hasDepthSensing()===!1,At&&Ot.addToRenderList(v,I),this.info.render.frame++,X===!0&&pt.beginShadows();const $=p.state.shadowsArray;Et.render($,I,q),X===!0&&pt.endShadows(),this.info.autoReset===!0&&this.info.reset();const K=v.opaque,j=v.transmissive;if(p.setupLights(),q.isArrayCamera){const gt=q.cameras;if(j.length>0)for(let Mt=0,kt=gt.length;Mt<kt;Mt++){const It=gt[Mt];Zl(K,j,I,It)}At&&Ot.render(I);for(let Mt=0,kt=gt.length;Mt<kt;Mt++){const It=gt[Mt];Kl(v,I,It,It.viewport)}}else j.length>0&&Zl(K,j,I,q),At&&Ot.render(I),Kl(v,I,q);R!==null&&(U.updateMultisampleRenderTarget(R),U.updateRenderTargetMipmap(R)),I.isScene===!0&&I.onAfterRender(_,I,q),be.resetDefaultState(),E=-1,D=null,x.pop(),x.length>0?(p=x[x.length-1],X===!0&&pt.setGlobalState(_.clippingPlanes,p.state.camera)):p=null,g.pop(),g.length>0?v=g[g.length-1]:v=null};function ha(I,q,$,K){if(I.visible===!1)return;if(I.layers.test(q.layers)){if(I.isGroup)$=I.renderOrder;else if(I.isLOD)I.autoUpdate===!0&&I.update(q);else if(I.isLight)p.pushLight(I),I.castShadow&&p.pushShadow(I);else if(I.isSprite){if(!I.frustumCulled||ut.intersectsSprite(I)){K&&lt.setFromMatrixPosition(I.matrixWorld).applyMatrix4(J);const Mt=it.update(I),kt=I.material;kt.visible&&v.push(I,Mt,kt,$,lt.z,null)}}else if((I.isMesh||I.isLine||I.isPoints)&&(!I.frustumCulled||ut.intersectsObject(I))){const Mt=it.update(I),kt=I.material;if(K&&(I.boundingSphere!==void 0?(I.boundingSphere===null&&I.computeBoundingSphere(),lt.copy(I.boundingSphere.center)):(Mt.boundingSphere===null&&Mt.computeBoundingSphere(),lt.copy(Mt.boundingSphere.center)),lt.applyMatrix4(I.matrixWorld).applyMatrix4(J)),Array.isArray(kt)){const It=Mt.groups;for(let qt=0,Yt=It.length;qt<Yt;qt++){const zt=It[qt],ve=kt[zt.materialIndex];ve&&ve.visible&&v.push(I,Mt,ve,$,lt.z,zt)}}else kt.visible&&v.push(I,Mt,kt,$,lt.z,null)}}const gt=I.children;for(let Mt=0,kt=gt.length;Mt<kt;Mt++)ha(gt[Mt],q,$,K)}function Kl(I,q,$,K){const j=I.opaque,gt=I.transmissive,Mt=I.transparent;p.setupLightsView($),X===!0&&pt.setGlobalState(_.clippingPlanes,$),K&&ft.viewport(M.copy(K)),j.length>0&&Ur(j,q,$),gt.length>0&&Ur(gt,q,$),Mt.length>0&&Ur(Mt,q,$),ft.buffers.depth.setTest(!0),ft.buffers.depth.setMask(!0),ft.buffers.color.setMask(!0),ft.setPolygonOffset(!1)}function Zl(I,q,$,K){if(($.isScene===!0?$.overrideMaterial:null)!==null)return;p.state.transmissionRenderTarget[K.id]===void 0&&(p.state.transmissionRenderTarget[K.id]=new ei(1,1,{generateMipmaps:!0,type:Lt.has("EXT_color_buffer_half_float")||Lt.has("EXT_color_buffer_float")?xi:ti,minFilter:Di,samples:4,stencilBuffer:s,resolveDepthBuffer:!1,resolveStencilBuffer:!1,colorSpace:me.workingColorSpace}));const gt=p.state.transmissionRenderTarget[K.id],Mt=K.viewport||M;gt.setSize(Mt.z,Mt.w);const kt=_.getRenderTarget();_.setRenderTarget(gt),_.getClearColor(N),z=_.getClearAlpha(),z<1&&_.setClearColor(16777215,.5),_.clear(),At&&Ot.render($);const It=_.toneMapping;_.toneMapping=Yn;const qt=K.viewport;if(K.viewport!==void 0&&(K.viewport=void 0),p.setupLightsView(K),X===!0&&pt.setGlobalState(_.clippingPlanes,K),Ur(I,$,K),U.updateMultisampleRenderTarget(gt),U.updateRenderTargetMipmap(gt),Lt.has("WEBGL_multisampled_render_to_texture")===!1){let Yt=!1;for(let zt=0,ve=q.length;zt<ve;zt++){const Te=q[zt],Pe=Te.object,mn=Te.geometry,fe=Te.material,Ft=Te.group;if(fe.side===cn&&Pe.layers.test(K.layers)){const $e=fe.side;fe.side=sn,fe.needsUpdate=!0,Jl(Pe,$,K,mn,fe,Ft),fe.side=$e,fe.needsUpdate=!0,Yt=!0}}Yt===!0&&(U.updateMultisampleRenderTarget(gt),U.updateRenderTargetMipmap(gt))}_.setRenderTarget(kt),_.setClearColor(N,z),qt!==void 0&&(K.viewport=qt),_.toneMapping=It}function Ur(I,q,$){const K=q.isScene===!0?q.overrideMaterial:null;for(let j=0,gt=I.length;j<gt;j++){const Mt=I[j],kt=Mt.object,It=Mt.geometry,qt=K===null?Mt.material:K,Yt=Mt.group;kt.layers.test($.layers)&&Jl(kt,q,$,It,qt,Yt)}}function Jl(I,q,$,K,j,gt){I.onBeforeRender(_,q,$,K,j,gt),I.modelViewMatrix.multiplyMatrices($.matrixWorldInverse,I.matrixWorld),I.normalMatrix.getNormalMatrix(I.modelViewMatrix),j.onBeforeRender(_,q,$,K,I,gt),j.transparent===!0&&j.side===cn&&j.forceSinglePass===!1?(j.side=sn,j.needsUpdate=!0,_.renderBufferDirect($,q,K,j,I,gt),j.side=Bi,j.needsUpdate=!0,_.renderBufferDirect($,q,K,j,I,gt),j.side=cn):_.renderBufferDirect($,q,K,j,I,gt),I.onAfterRender(_,q,$,K,j,gt)}function zr(I,q,$){q.isScene!==!0&&(q=bt);const K=mt.get(I),j=p.state.lights,gt=p.state.shadowsArray,Mt=j.state.version,kt=Nt.getParameters(I,j.state,gt,q,$),It=Nt.getProgramCacheKey(kt);let qt=K.programs;K.environment=I.isMeshStandardMaterial?q.environment:null,K.fog=q.fog,K.envMap=(I.isMeshStandardMaterial?Y:C).get(I.envMap||K.environment),K.envMapRotation=K.environment!==null&&I.envMap===null?q.environmentRotation:I.envMapRotation,qt===void 0&&(I.addEventListener("dispose",ce),qt=new Map,K.programs=qt);let Yt=qt.get(It);if(Yt!==void 0){if(K.currentProgram===Yt&&K.lightsStateVersion===Mt)return th(I,kt),Yt}else kt.uniforms=Nt.getUniforms(I),I.onBeforeCompile(kt,_),Yt=Nt.acquireProgram(kt,It),qt.set(It,Yt),K.uniforms=kt.uniforms;const zt=K.uniforms;return(!I.isShaderMaterial&&!I.isRawShaderMaterial||I.clipping===!0)&&(zt.clippingPlanes=pt.uniform),th(I,kt),K.needsLights=Y0(I),K.lightsStateVersion=Mt,K.needsLights&&(zt.ambientLightColor.value=j.state.ambient,zt.lightProbe.value=j.state.probe,zt.directionalLights.value=j.state.directional,zt.directionalLightShadows.value=j.state.directionalShadow,zt.spotLights.value=j.state.spot,zt.spotLightShadows.value=j.state.spotShadow,zt.rectAreaLights.value=j.state.rectArea,zt.ltc_1.value=j.state.rectAreaLTC1,zt.ltc_2.value=j.state.rectAreaLTC2,zt.pointLights.value=j.state.point,zt.pointLightShadows.value=j.state.pointShadow,zt.hemisphereLights.value=j.state.hemi,zt.directionalShadowMap.value=j.state.directionalShadowMap,zt.directionalShadowMatrix.value=j.state.directionalShadowMatrix,zt.spotShadowMap.value=j.state.spotShadowMap,zt.spotLightMatrix.value=j.state.spotLightMatrix,zt.spotLightMap.value=j.state.spotLightMap,zt.pointShadowMap.value=j.state.pointShadowMap,zt.pointShadowMatrix.value=j.state.pointShadowMatrix),K.currentProgram=Yt,K.uniformsList=null,Yt}function Ql(I){if(I.uniformsList===null){const q=I.currentProgram.getUniforms();I.uniformsList=Do.seqWithValue(q.seq,I.uniforms)}return I.uniformsList}function th(I,q){const $=mt.get(I);$.outputColorSpace=q.outputColorSpace,$.batching=q.batching,$.batchingColor=q.batchingColor,$.instancing=q.instancing,$.instancingColor=q.instancingColor,$.instancingMorph=q.instancingMorph,$.skinning=q.skinning,$.morphTargets=q.morphTargets,$.morphNormals=q.morphNormals,$.morphColors=q.morphColors,$.morphTargetsCount=q.morphTargetsCount,$.numClippingPlanes=q.numClippingPlanes,$.numIntersection=q.numClipIntersection,$.vertexAlphas=q.vertexAlphas,$.vertexTangents=q.vertexTangents,$.toneMapping=q.toneMapping}function X0(I,q,$,K,j){q.isScene!==!0&&(q=bt),U.resetTextureUnits();const gt=q.fog,Mt=K.isMeshStandardMaterial?q.environment:null,kt=R===null?_.outputColorSpace:R.isXRRenderTarget===!0?R.texture.colorSpace:Hi,It=(K.isMeshStandardMaterial?Y:C).get(K.envMap||Mt),qt=K.vertexColors===!0&&!!$.attributes.color&&$.attributes.color.itemSize===4,Yt=!!$.attributes.tangent&&(!!K.normalMap||K.anisotropy>0),zt=!!$.morphAttributes.position,ve=!!$.morphAttributes.normal,Te=!!$.morphAttributes.color;let Pe=Yn;K.toneMapped&&(R===null||R.isXRRenderTarget===!0)&&(Pe=_.toneMapping);const mn=$.morphAttributes.position||$.morphAttributes.normal||$.morphAttributes.color,fe=mn!==void 0?mn.length:0,Ft=mt.get(K),$e=p.state.lights;if(X===!0&&(Z===!0||I!==D)){const Tn=I===D&&K.id===E;pt.setState(K,I,Tn)}let pe=!1;K.version===Ft.__version?(Ft.needsLights&&Ft.lightsStateVersion!==$e.state.version||Ft.outputColorSpace!==kt||j.isBatchedMesh&&Ft.batching===!1||!j.isBatchedMesh&&Ft.batching===!0||j.isBatchedMesh&&Ft.batchingColor===!0&&j.colorTexture===null||j.isBatchedMesh&&Ft.batchingColor===!1&&j.colorTexture!==null||j.isInstancedMesh&&Ft.instancing===!1||!j.isInstancedMesh&&Ft.instancing===!0||j.isSkinnedMesh&&Ft.skinning===!1||!j.isSkinnedMesh&&Ft.skinning===!0||j.isInstancedMesh&&Ft.instancingColor===!0&&j.instanceColor===null||j.isInstancedMesh&&Ft.instancingColor===!1&&j.instanceColor!==null||j.isInstancedMesh&&Ft.instancingMorph===!0&&j.morphTexture===null||j.isInstancedMesh&&Ft.instancingMorph===!1&&j.morphTexture!==null||Ft.envMap!==It||K.fog===!0&&Ft.fog!==gt||Ft.numClippingPlanes!==void 0&&(Ft.numClippingPlanes!==pt.numPlanes||Ft.numIntersection!==pt.numIntersection)||Ft.vertexAlphas!==qt||Ft.vertexTangents!==Yt||Ft.morphTargets!==zt||Ft.morphNormals!==ve||Ft.morphColors!==Te||Ft.toneMapping!==Pe||Ft.morphTargetsCount!==fe)&&(pe=!0):(pe=!0,Ft.__version=K.version);let Dn=Ft.currentProgram;pe===!0&&(Dn=zr(K,q,j));let as=!1,gn=!1,ua=!1;const ke=Dn.getUniforms(),yi=Ft.uniforms;if(ft.useProgram(Dn.program)&&(as=!0,gn=!0,ua=!0),K.id!==E&&(E=K.id,gn=!0),as||D!==I){vt.reverseDepthBuffer?(rt.copy(I.projectionMatrix),Kd(rt),Zd(rt),ke.setValue(F,"projectionMatrix",rt)):ke.setValue(F,"projectionMatrix",I.projectionMatrix),ke.setValue(F,"viewMatrix",I.matrixWorldInverse);const Tn=ke.map.cameraPosition;Tn!==void 0&&Tn.setValue(F,ot.setFromMatrixPosition(I.matrixWorld)),vt.logarithmicDepthBuffer&&ke.setValue(F,"logDepthBufFC",2/(Math.log(I.far+1)/Math.LN2)),(K.isMeshPhongMaterial||K.isMeshToonMaterial||K.isMeshLambertMaterial||K.isMeshBasicMaterial||K.isMeshStandardMaterial||K.isShaderMaterial)&&ke.setValue(F,"isOrthographic",I.isOrthographicCamera===!0),D!==I&&(D=I,gn=!0,ua=!0)}if(j.isSkinnedMesh){ke.setOptional(F,j,"bindMatrix"),ke.setOptional(F,j,"bindMatrixInverse");const Tn=j.skeleton;Tn&&(Tn.boneTexture===null&&Tn.computeBoneTexture(),ke.setValue(F,"boneTexture",Tn.boneTexture,U))}j.isBatchedMesh&&(ke.setOptional(F,j,"batchingTexture"),ke.setValue(F,"batchingTexture",j._matricesTexture,U),ke.setOptional(F,j,"batchingIdTexture"),ke.setValue(F,"batchingIdTexture",j._indirectTexture,U),ke.setOptional(F,j,"batchingColorTexture"),j._colorsTexture!==null&&ke.setValue(F,"batchingColorTexture",j._colorsTexture,U));const da=$.morphAttributes;if((da.position!==void 0||da.normal!==void 0||da.color!==void 0)&&Wt.update(j,$,Dn),(gn||Ft.receiveShadow!==j.receiveShadow)&&(Ft.receiveShadow=j.receiveShadow,ke.setValue(F,"receiveShadow",j.receiveShadow)),K.isMeshGouraudMaterial&&K.envMap!==null&&(yi.envMap.value=It,yi.flipEnvMap.value=It.isCubeTexture&&It.isRenderTargetTexture===!1?-1:1),K.isMeshStandardMaterial&&K.envMap===null&&q.environment!==null&&(yi.envMapIntensity.value=q.environmentIntensity),gn&&(ke.setValue(F,"toneMappingExposure",_.toneMappingExposure),Ft.needsLights&&j0(yi,ua),gt&&K.fog===!0&&_t.refreshFogUniforms(yi,gt),_t.refreshMaterialUniforms(yi,K,V,L,p.state.transmissionRenderTarget[I.id]),Do.upload(F,Ql(Ft),yi,U)),K.isShaderMaterial&&K.uniformsNeedUpdate===!0&&(Do.upload(F,Ql(Ft),yi,U),K.uniformsNeedUpdate=!1),K.isSpriteMaterial&&ke.setValue(F,"center",j.center),ke.setValue(F,"modelViewMatrix",j.modelViewMatrix),ke.setValue(F,"normalMatrix",j.normalMatrix),ke.setValue(F,"modelMatrix",j.matrixWorld),K.isShaderMaterial||K.isRawShaderMaterial){const Tn=K.uniformsGroups;for(let fa=0,$0=Tn.length;fa<$0;fa++){const eh=Tn[fa];W.update(eh,Dn),W.bind(eh,Dn)}}return Dn}function j0(I,q){I.ambientLightColor.needsUpdate=q,I.lightProbe.needsUpdate=q,I.directionalLights.needsUpdate=q,I.directionalLightShadows.needsUpdate=q,I.pointLights.needsUpdate=q,I.pointLightShadows.needsUpdate=q,I.spotLights.needsUpdate=q,I.spotLightShadows.needsUpdate=q,I.rectAreaLights.needsUpdate=q,I.hemisphereLights.needsUpdate=q}function Y0(I){return I.isMeshLambertMaterial||I.isMeshToonMaterial||I.isMeshPhongMaterial||I.isMeshStandardMaterial||I.isShadowMaterial||I.isShaderMaterial&&I.lights===!0}this.getActiveCubeFace=function(){return w},this.getActiveMipmapLevel=function(){return T},this.getRenderTarget=function(){return R},this.setRenderTargetTextures=function(I,q,$){mt.get(I.texture).__webglTexture=q,mt.get(I.depthTexture).__webglTexture=$;const K=mt.get(I);K.__hasExternalTextures=!0,K.__autoAllocateDepthBuffer=$===void 0,K.__autoAllocateDepthBuffer||Lt.has("WEBGL_multisampled_render_to_texture")===!0&&(console.warn("THREE.WebGLRenderer: Render-to-texture extension was disabled because an external texture was provided"),K.__useRenderToTexture=!1)},this.setRenderTargetFramebuffer=function(I,q){const $=mt.get(I);$.__webglFramebuffer=q,$.__useDefaultFramebuffer=q===void 0},this.setRenderTarget=function(I,q=0,$=0){R=I,w=q,T=$;let K=!0,j=null,gt=!1,Mt=!1;if(I){const It=mt.get(I);if(It.__useDefaultFramebuffer!==void 0)ft.bindFramebuffer(F.FRAMEBUFFER,null),K=!1;else if(It.__webglFramebuffer===void 0)U.setupRenderTarget(I);else if(It.__hasExternalTextures)U.rebindTextures(I,mt.get(I.texture).__webglTexture,mt.get(I.depthTexture).__webglTexture);else if(I.depthBuffer){const zt=I.depthTexture;if(It.__boundDepthTexture!==zt){if(zt!==null&&mt.has(zt)&&(I.width!==zt.image.width||I.height!==zt.image.height))throw new Error("WebGLRenderTarget: Attached DepthTexture is initialized to the incorrect size.");U.setupDepthRenderbuffer(I)}}const qt=I.texture;(qt.isData3DTexture||qt.isDataArrayTexture||qt.isCompressedArrayTexture)&&(Mt=!0);const Yt=mt.get(I).__webglFramebuffer;I.isWebGLCubeRenderTarget?(Array.isArray(Yt[q])?j=Yt[q][$]:j=Yt[q],gt=!0):I.samples>0&&U.useMultisampledRTT(I)===!1?j=mt.get(I).__webglMultisampledFramebuffer:Array.isArray(Yt)?j=Yt[$]:j=Yt,M.copy(I.viewport),S.copy(I.scissor),k=I.scissorTest}else M.copy(B).multiplyScalar(V).floor(),S.copy(G).multiplyScalar(V).floor(),k=Q;if(ft.bindFramebuffer(F.FRAMEBUFFER,j)&&K&&ft.drawBuffers(I,j),ft.viewport(M),ft.scissor(S),ft.setScissorTest(k),gt){const It=mt.get(I.texture);F.framebufferTexture2D(F.FRAMEBUFFER,F.COLOR_ATTACHMENT0,F.TEXTURE_CUBE_MAP_POSITIVE_X+q,It.__webglTexture,$)}else if(Mt){const It=mt.get(I.texture),qt=q||0;F.framebufferTextureLayer(F.FRAMEBUFFER,F.COLOR_ATTACHMENT0,It.__webglTexture,$||0,qt)}E=-1},this.readRenderTargetPixels=function(I,q,$,K,j,gt,Mt){if(!(I&&I.isWebGLRenderTarget)){console.error("THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not THREE.WebGLRenderTarget.");return}let kt=mt.get(I).__webglFramebuffer;if(I.isWebGLCubeRenderTarget&&Mt!==void 0&&(kt=kt[Mt]),kt){ft.bindFramebuffer(F.FRAMEBUFFER,kt);try{const It=I.texture,qt=It.format,Yt=It.type;if(!vt.textureFormatReadable(qt)){console.error("THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not in RGBA or implementation defined format.");return}if(!vt.textureTypeReadable(Yt)){console.error("THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not in UnsignedByteType or implementation defined type.");return}q>=0&&q<=I.width-K&&$>=0&&$<=I.height-j&&F.readPixels(q,$,K,j,Jt.convert(qt),Jt.convert(Yt),gt)}finally{const It=R!==null?mt.get(R).__webglFramebuffer:null;ft.bindFramebuffer(F.FRAMEBUFFER,It)}}},this.readRenderTargetPixelsAsync=async function(I,q,$,K,j,gt,Mt){if(!(I&&I.isWebGLRenderTarget))throw new Error("THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not THREE.WebGLRenderTarget.");let kt=mt.get(I).__webglFramebuffer;if(I.isWebGLCubeRenderTarget&&Mt!==void 0&&(kt=kt[Mt]),kt){const It=I.texture,qt=It.format,Yt=It.type;if(!vt.textureFormatReadable(qt))throw new Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: renderTarget is not in RGBA or implementation defined format.");if(!vt.textureTypeReadable(Yt))throw new Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: renderTarget is not in UnsignedByteType or implementation defined type.");if(q>=0&&q<=I.width-K&&$>=0&&$<=I.height-j){ft.bindFramebuffer(F.FRAMEBUFFER,kt);const zt=F.createBuffer();F.bindBuffer(F.PIXEL_PACK_BUFFER,zt),F.bufferData(F.PIXEL_PACK_BUFFER,gt.byteLength,F.STREAM_READ),F.readPixels(q,$,K,j,Jt.convert(qt),Jt.convert(Yt),0);const ve=R!==null?mt.get(R).__webglFramebuffer:null;ft.bindFramebuffer(F.FRAMEBUFFER,ve);const Te=F.fenceSync(F.SYNC_GPU_COMMANDS_COMPLETE,0);return F.flush(),await $d(F,Te,4),F.bindBuffer(F.PIXEL_PACK_BUFFER,zt),F.getBufferSubData(F.PIXEL_PACK_BUFFER,0,gt),F.deleteBuffer(zt),F.deleteSync(Te),gt}else throw new Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: requested read bounds are out of range.")}},this.copyFramebufferToTexture=function(I,q=null,$=0){I.isTexture!==!0&&(ko("WebGLRenderer: copyFramebufferToTexture function signature has changed."),q=arguments[0]||null,I=arguments[1]);const K=Math.pow(2,-$),j=Math.floor(I.image.width*K),gt=Math.floor(I.image.height*K),Mt=q!==null?q.x:0,kt=q!==null?q.y:0;U.setTexture2D(I,0),F.copyTexSubImage2D(F.TEXTURE_2D,$,0,0,Mt,kt,j,gt),ft.unbindTexture()},this.copyTextureToTexture=function(I,q,$=null,K=null,j=0){I.isTexture!==!0&&(ko("WebGLRenderer: copyTextureToTexture function signature has changed."),K=arguments[0]||null,I=arguments[1],q=arguments[2],j=arguments[3]||0,$=null);let gt,Mt,kt,It,qt,Yt;$!==null?(gt=$.max.x-$.min.x,Mt=$.max.y-$.min.y,kt=$.min.x,It=$.min.y):(gt=I.image.width,Mt=I.image.height,kt=0,It=0),K!==null?(qt=K.x,Yt=K.y):(qt=0,Yt=0);const zt=Jt.convert(q.format),ve=Jt.convert(q.type);U.setTexture2D(q,0),F.pixelStorei(F.UNPACK_FLIP_Y_WEBGL,q.flipY),F.pixelStorei(F.UNPACK_PREMULTIPLY_ALPHA_WEBGL,q.premultiplyAlpha),F.pixelStorei(F.UNPACK_ALIGNMENT,q.unpackAlignment);const Te=F.getParameter(F.UNPACK_ROW_LENGTH),Pe=F.getParameter(F.UNPACK_IMAGE_HEIGHT),mn=F.getParameter(F.UNPACK_SKIP_PIXELS),fe=F.getParameter(F.UNPACK_SKIP_ROWS),Ft=F.getParameter(F.UNPACK_SKIP_IMAGES),$e=I.isCompressedTexture?I.mipmaps[j]:I.image;F.pixelStorei(F.UNPACK_ROW_LENGTH,$e.width),F.pixelStorei(F.UNPACK_IMAGE_HEIGHT,$e.height),F.pixelStorei(F.UNPACK_SKIP_PIXELS,kt),F.pixelStorei(F.UNPACK_SKIP_ROWS,It),I.isDataTexture?F.texSubImage2D(F.TEXTURE_2D,j,qt,Yt,gt,Mt,zt,ve,$e.data):I.isCompressedTexture?F.compressedTexSubImage2D(F.TEXTURE_2D,j,qt,Yt,$e.width,$e.height,zt,$e.data):F.texSubImage2D(F.TEXTURE_2D,j,qt,Yt,gt,Mt,zt,ve,$e),F.pixelStorei(F.UNPACK_ROW_LENGTH,Te),F.pixelStorei(F.UNPACK_IMAGE_HEIGHT,Pe),F.pixelStorei(F.UNPACK_SKIP_PIXELS,mn),F.pixelStorei(F.UNPACK_SKIP_ROWS,fe),F.pixelStorei(F.UNPACK_SKIP_IMAGES,Ft),j===0&&q.generateMipmaps&&F.generateMipmap(F.TEXTURE_2D),ft.unbindTexture()},this.copyTextureToTexture3D=function(I,q,$=null,K=null,j=0){I.isTexture!==!0&&(ko("WebGLRenderer: copyTextureToTexture3D function signature has changed."),$=arguments[0]||null,K=arguments[1]||null,I=arguments[2],q=arguments[3],j=arguments[4]||0);let gt,Mt,kt,It,qt,Yt,zt,ve,Te;const Pe=I.isCompressedTexture?I.mipmaps[j]:I.image;$!==null?(gt=$.max.x-$.min.x,Mt=$.max.y-$.min.y,kt=$.max.z-$.min.z,It=$.min.x,qt=$.min.y,Yt=$.min.z):(gt=Pe.width,Mt=Pe.height,kt=Pe.depth,It=0,qt=0,Yt=0),K!==null?(zt=K.x,ve=K.y,Te=K.z):(zt=0,ve=0,Te=0);const mn=Jt.convert(q.format),fe=Jt.convert(q.type);let Ft;if(q.isData3DTexture)U.setTexture3D(q,0),Ft=F.TEXTURE_3D;else if(q.isDataArrayTexture||q.isCompressedArrayTexture)U.setTexture2DArray(q,0),Ft=F.TEXTURE_2D_ARRAY;else{console.warn("THREE.WebGLRenderer.copyTextureToTexture3D: only supports THREE.DataTexture3D and THREE.DataTexture2DArray.");return}F.pixelStorei(F.UNPACK_FLIP_Y_WEBGL,q.flipY),F.pixelStorei(F.UNPACK_PREMULTIPLY_ALPHA_WEBGL,q.premultiplyAlpha),F.pixelStorei(F.UNPACK_ALIGNMENT,q.unpackAlignment);const $e=F.getParameter(F.UNPACK_ROW_LENGTH),pe=F.getParameter(F.UNPACK_IMAGE_HEIGHT),Dn=F.getParameter(F.UNPACK_SKIP_PIXELS),as=F.getParameter(F.UNPACK_SKIP_ROWS),gn=F.getParameter(F.UNPACK_SKIP_IMAGES);F.pixelStorei(F.UNPACK_ROW_LENGTH,Pe.width),F.pixelStorei(F.UNPACK_IMAGE_HEIGHT,Pe.height),F.pixelStorei(F.UNPACK_SKIP_PIXELS,It),F.pixelStorei(F.UNPACK_SKIP_ROWS,qt),F.pixelStorei(F.UNPACK_SKIP_IMAGES,Yt),I.isDataTexture||I.isData3DTexture?F.texSubImage3D(Ft,j,zt,ve,Te,gt,Mt,kt,mn,fe,Pe.data):q.isCompressedArrayTexture?F.compressedTexSubImage3D(Ft,j,zt,ve,Te,gt,Mt,kt,mn,Pe.data):F.texSubImage3D(Ft,j,zt,ve,Te,gt,Mt,kt,mn,fe,Pe),F.pixelStorei(F.UNPACK_ROW_LENGTH,$e),F.pixelStorei(F.UNPACK_IMAGE_HEIGHT,pe),F.pixelStorei(F.UNPACK_SKIP_PIXELS,Dn),F.pixelStorei(F.UNPACK_SKIP_ROWS,as),F.pixelStorei(F.UNPACK_SKIP_IMAGES,gn),j===0&&q.generateMipmaps&&F.generateMipmap(Ft),ft.unbindTexture()},this.initRenderTarget=function(I){mt.get(I).__webglFramebuffer===void 0&&U.setupRenderTarget(I)},this.initTexture=function(I){I.isCubeTexture?U.setTextureCube(I,0):I.isData3DTexture?U.setTexture3D(I,0):I.isDataArrayTexture||I.isCompressedArrayTexture?U.setTexture2DArray(I,0):U.setTexture2D(I,0),ft.unbindTexture()},this.resetState=function(){w=0,T=0,R=null,ft.reset(),be.reset()},typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe",{detail:this}))}get coordinateSystem(){return di}get outputColorSpace(){return this._outputColorSpace}set outputColorSpace(t){this._outputColorSpace=t;const e=this.getContext();e.drawingBufferColorSpace=t===yl?"display-p3":"srgb",e.unpackColorSpace=me.workingColorSpace===Qo?"display-p3":"srgb"}}class T0 extends _e{constructor(){super(),this.isScene=!0,this.type="Scene",this.background=null,this.environment=null,this.fog=null,this.backgroundBlurriness=0,this.backgroundIntensity=1,this.backgroundRotation=new Ve,this.environmentIntensity=1,this.environmentRotation=new Ve,this.overrideMaterial=null,typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe",{detail:this}))}copy(t,e){return super.copy(t,e),t.background!==null&&(this.background=t.background.clone()),t.environment!==null&&(this.environment=t.environment.clone()),t.fog!==null&&(this.fog=t.fog.clone()),this.backgroundBlurriness=t.backgroundBlurriness,this.backgroundIntensity=t.backgroundIntensity,this.backgroundRotation.copy(t.backgroundRotation),this.environmentIntensity=t.environmentIntensity,this.environmentRotation.copy(t.environmentRotation),t.overrideMaterial!==null&&(this.overrideMaterial=t.overrideMaterial.clone()),this.matrixAutoUpdate=t.matrixAutoUpdate,this}toJSON(t){const e=super.toJSON(t);return this.fog!==null&&(e.object.fog=this.fog.toJSON()),this.backgroundBlurriness>0&&(e.object.backgroundBlurriness=this.backgroundBlurriness),this.backgroundIntensity!==1&&(e.object.backgroundIntensity=this.backgroundIntensity),e.object.backgroundRotation=this.backgroundRotation.toArray(),this.environmentIntensity!==1&&(e.object.environmentIntensity=this.environmentIntensity),e.object.environmentRotation=this.environmentRotation.toArray(),e}}class ov{constructor(t,e){this.isInterleavedBuffer=!0,this.array=t,this.stride=e,this.count=t!==void 0?t.length/e:0,this.usage=Qc,this.updateRanges=[],this.version=0,this.uuid=$n()}onUploadCallback(){}set needsUpdate(t){t===!0&&this.version++}setUsage(t){return this.usage=t,this}addUpdateRange(t,e){this.updateRanges.push({start:t,count:e})}clearUpdateRanges(){this.updateRanges.length=0}copy(t){return this.array=new t.array.constructor(t.array),this.count=t.count,this.stride=t.stride,this.usage=t.usage,this}copyAt(t,e,n){t*=this.stride,n*=e.stride;for(let i=0,s=this.stride;i<s;i++)this.array[t+i]=e.array[n+i];return this}set(t,e=0){return this.array.set(t,e),this}clone(t){t.arrayBuffers===void 0&&(t.arrayBuffers={}),this.array.buffer._uuid===void 0&&(this.array.buffer._uuid=$n()),t.arrayBuffers[this.array.buffer._uuid]===void 0&&(t.arrayBuffers[this.array.buffer._uuid]=this.array.slice(0).buffer);const e=new this.array.constructor(t.arrayBuffers[this.array.buffer._uuid]),n=new this.constructor(e,this.stride);return n.setUsage(this.usage),n}onUpload(t){return this.onUploadCallback=t,this}toJSON(t){return t.arrayBuffers===void 0&&(t.arrayBuffers={}),this.array.buffer._uuid===void 0&&(this.array.buffer._uuid=$n()),t.arrayBuffers[this.array.buffer._uuid]===void 0&&(t.arrayBuffers[this.array.buffer._uuid]=Array.from(new Uint32Array(this.array.buffer))),{uuid:this.uuid,buffer:this.array.buffer._uuid,type:this.array.constructor.name,stride:this.stride}}}const rn=new A;class Wo{constructor(t,e,n,i=!1){this.isInterleavedBufferAttribute=!0,this.name="",this.data=t,this.itemSize=e,this.offset=n,this.normalized=i}get count(){return this.data.count}get array(){return this.data.array}set needsUpdate(t){this.data.needsUpdate=t}applyMatrix4(t){for(let e=0,n=this.data.count;e<n;e++)rn.fromBufferAttribute(this,e),rn.applyMatrix4(t),this.setXYZ(e,rn.x,rn.y,rn.z);return this}applyNormalMatrix(t){for(let e=0,n=this.count;e<n;e++)rn.fromBufferAttribute(this,e),rn.applyNormalMatrix(t),this.setXYZ(e,rn.x,rn.y,rn.z);return this}transformDirection(t){for(let e=0,n=this.count;e<n;e++)rn.fromBufferAttribute(this,e),rn.transformDirection(t),this.setXYZ(e,rn.x,rn.y,rn.z);return this}getComponent(t,e){let n=this.array[t*this.data.stride+this.offset+e];return this.normalized&&(n=On(n,this.array)),n}setComponent(t,e,n){return this.normalized&&(n=xe(n,this.array)),this.data.array[t*this.data.stride+this.offset+e]=n,this}setX(t,e){return this.normalized&&(e=xe(e,this.array)),this.data.array[t*this.data.stride+this.offset]=e,this}setY(t,e){return this.normalized&&(e=xe(e,this.array)),this.data.array[t*this.data.stride+this.offset+1]=e,this}setZ(t,e){return this.normalized&&(e=xe(e,this.array)),this.data.array[t*this.data.stride+this.offset+2]=e,this}setW(t,e){return this.normalized&&(e=xe(e,this.array)),this.data.array[t*this.data.stride+this.offset+3]=e,this}getX(t){let e=this.data.array[t*this.data.stride+this.offset];return this.normalized&&(e=On(e,this.array)),e}getY(t){let e=this.data.array[t*this.data.stride+this.offset+1];return this.normalized&&(e=On(e,this.array)),e}getZ(t){let e=this.data.array[t*this.data.stride+this.offset+2];return this.normalized&&(e=On(e,this.array)),e}getW(t){let e=this.data.array[t*this.data.stride+this.offset+3];return this.normalized&&(e=On(e,this.array)),e}setXY(t,e,n){return t=t*this.data.stride+this.offset,this.normalized&&(e=xe(e,this.array),n=xe(n,this.array)),this.data.array[t+0]=e,this.data.array[t+1]=n,this}setXYZ(t,e,n,i){return t=t*this.data.stride+this.offset,this.normalized&&(e=xe(e,this.array),n=xe(n,this.array),i=xe(i,this.array)),this.data.array[t+0]=e,this.data.array[t+1]=n,this.data.array[t+2]=i,this}setXYZW(t,e,n,i,s){return t=t*this.data.stride+this.offset,this.normalized&&(e=xe(e,this.array),n=xe(n,this.array),i=xe(i,this.array),s=xe(s,this.array)),this.data.array[t+0]=e,this.data.array[t+1]=n,this.data.array[t+2]=i,this.data.array[t+3]=s,this}clone(t){if(t===void 0){console.log("THREE.InterleavedBufferAttribute.clone(): Cloning an interleaved buffer attribute will de-interleave buffer data.");const e=[];for(let n=0;n<this.count;n++){const i=n*this.data.stride+this.offset;for(let s=0;s<this.itemSize;s++)e.push(this.data.array[i+s])}return new te(new this.array.constructor(e),this.itemSize,this.normalized)}else return t.interleavedBuffers===void 0&&(t.interleavedBuffers={}),t.interleavedBuffers[this.data.uuid]===void 0&&(t.interleavedBuffers[this.data.uuid]=this.data.clone(t)),new Wo(t.interleavedBuffers[this.data.uuid],this.itemSize,this.offset,this.normalized)}toJSON(t){if(t===void 0){console.log("THREE.InterleavedBufferAttribute.toJSON(): Serializing an interleaved buffer attribute will de-interleave buffer data.");const e=[];for(let n=0;n<this.count;n++){const i=n*this.data.stride+this.offset;for(let s=0;s<this.itemSize;s++)e.push(this.data.array[i+s])}return{itemSize:this.itemSize,type:this.array.constructor.name,array:e,normalized:this.normalized}}else return t.interleavedBuffers===void 0&&(t.interleavedBuffers={}),t.interleavedBuffers[this.data.uuid]===void 0&&(t.interleavedBuffers[this.data.uuid]=this.data.toJSON(t)),{isInterleavedBufferAttribute:!0,itemSize:this.itemSize,data:this.data.uuid,offset:this.offset,normalized:this.normalized}}}class E0 extends Gi{constructor(t){super(),this.isSpriteMaterial=!0,this.type="SpriteMaterial",this.color=new dt(16777215),this.map=null,this.alphaMap=null,this.rotation=0,this.sizeAttenuation=!0,this.transparent=!0,this.fog=!0,this.setValues(t)}copy(t){return super.copy(t),this.color.copy(t.color),this.map=t.map,this.alphaMap=t.alphaMap,this.rotation=t.rotation,this.sizeAttenuation=t.sizeAttenuation,this.fog=t.fog,this}}let bs;const rr=new A,Ss=new A,ws=new A,Ts=new ct,or=new ct,A0=new Dt,ro=new A,ar=new A,oo=new A,$h=new ct,Ga=new ct,Kh=new ct;class av extends _e{constructor(t=new E0){if(super(),this.isSprite=!0,this.type="Sprite",bs===void 0){bs=new ge;const e=new Float32Array([-.5,-.5,0,0,0,.5,-.5,0,1,0,.5,.5,0,1,1,-.5,.5,0,0,1]),n=new ov(e,5);bs.setIndex([0,1,2,0,2,3]),bs.setAttribute("position",new Wo(n,3,0,!1)),bs.setAttribute("uv",new Wo(n,2,3,!1))}this.geometry=bs,this.material=t,this.center=new ct(.5,.5)}raycast(t,e){t.camera===null&&console.error('THREE.Sprite: "Raycaster.camera" needs to be set in order to raycast against sprites.'),Ss.setFromMatrixScale(this.matrixWorld),A0.copy(t.camera.matrixWorld),this.modelViewMatrix.multiplyMatrices(t.camera.matrixWorldInverse,this.matrixWorld),ws.setFromMatrixPosition(this.modelViewMatrix),t.camera.isPerspectiveCamera&&this.material.sizeAttenuation===!1&&Ss.multiplyScalar(-ws.z);const n=this.material.rotation;let i,s;n!==0&&(s=Math.cos(n),i=Math.sin(n));const o=this.center;ao(ro.set(-.5,-.5,0),ws,o,Ss,i,s),ao(ar.set(.5,-.5,0),ws,o,Ss,i,s),ao(oo.set(.5,.5,0),ws,o,Ss,i,s),$h.set(0,0),Ga.set(1,0),Kh.set(1,1);let a=t.ray.intersectTriangle(ro,ar,oo,!1,rr);if(a===null&&(ao(ar.set(-.5,.5,0),ws,o,Ss,i,s),Ga.set(0,1),a=t.ray.intersectTriangle(ro,oo,ar,!1,rr),a===null))return;const c=t.ray.origin.distanceTo(rr);c<t.near||c>t.far||e.push({distance:c,point:rr.clone(),uv:Ln.getInterpolation(rr,ro,ar,oo,$h,Ga,Kh,new ct),face:null,object:this})}copy(t,e){return super.copy(t,e),t.center!==void 0&&this.center.copy(t.center),this.material=t.material,this}}function ao(r,t,e,n,i,s){Ts.subVectors(r,e).addScalar(.5).multiply(n),i!==void 0?(or.x=s*Ts.x-i*Ts.y,or.y=i*Ts.x+s*Ts.y):or.copy(Ts),r.copy(t),r.x+=or.x,r.y+=or.y,r.applyMatrix4(A0)}const Zh=new A,Jh=new we,Qh=new we,cv=new A,tu=new Dt,co=new A,Wa=new ni,eu=new Dt,qa=new ta;class nu extends Ht{constructor(t,e){super(t,e),this.isSkinnedMesh=!0,this.type="SkinnedMesh",this.bindMode=rh,this.bindMatrix=new Dt,this.bindMatrixInverse=new Dt,this.boundingBox=null,this.boundingSphere=null}computeBoundingBox(){const t=this.geometry;this.boundingBox===null&&(this.boundingBox=new Vi),this.boundingBox.makeEmpty();const e=t.getAttribute("position");for(let n=0;n<e.count;n++)this.getVertexPosition(n,co),this.boundingBox.expandByPoint(co)}computeBoundingSphere(){const t=this.geometry;this.boundingSphere===null&&(this.boundingSphere=new ni),this.boundingSphere.makeEmpty();const e=t.getAttribute("position");for(let n=0;n<e.count;n++)this.getVertexPosition(n,co),this.boundingSphere.expandByPoint(co)}copy(t,e){return super.copy(t,e),this.bindMode=t.bindMode,this.bindMatrix.copy(t.bindMatrix),this.bindMatrixInverse.copy(t.bindMatrixInverse),this.skeleton=t.skeleton,t.boundingBox!==null&&(this.boundingBox=t.boundingBox.clone()),t.boundingSphere!==null&&(this.boundingSphere=t.boundingSphere.clone()),this}raycast(t,e){const n=this.material,i=this.matrixWorld;n!==void 0&&(this.boundingSphere===null&&this.computeBoundingSphere(),Wa.copy(this.boundingSphere),Wa.applyMatrix4(i),t.ray.intersectsSphere(Wa)!==!1&&(eu.copy(i).invert(),qa.copy(t.ray).applyMatrix4(eu),!(this.boundingBox!==null&&qa.intersectsBox(this.boundingBox)===!1)&&this._computeIntersections(t,e,qa)))}getVertexPosition(t,e){return super.getVertexPosition(t,e),this.applyBoneTransform(t,e),e}bind(t,e){this.skeleton=t,e===void 0&&(this.updateMatrixWorld(!0),this.skeleton.calculateInverses(),e=this.matrixWorld),this.bindMatrix.copy(e),this.bindMatrixInverse.copy(e).invert()}pose(){this.skeleton.pose()}normalizeSkinWeights(){const t=new we,e=this.geometry.attributes.skinWeight;for(let n=0,i=e.count;n<i;n++){t.fromBufferAttribute(e,n);const s=1/t.manhattanLength();s!==1/0?t.multiplyScalar(s):t.set(1,0,0,0),e.setXYZW(n,t.x,t.y,t.z,t.w)}}updateMatrixWorld(t){super.updateMatrixWorld(t),this.bindMode===rh?this.bindMatrixInverse.copy(this.matrixWorld).invert():this.bindMode===yd?this.bindMatrixInverse.copy(this.bindMatrix).invert():console.warn("THREE.SkinnedMesh: Unrecognized bindMode: "+this.bindMode)}applyBoneTransform(t,e){const n=this.skeleton,i=this.geometry;Jh.fromBufferAttribute(i.attributes.skinIndex,t),Qh.fromBufferAttribute(i.attributes.skinWeight,t),Zh.copy(e).applyMatrix4(this.bindMatrix),e.set(0,0,0);for(let s=0;s<4;s++){const o=Qh.getComponent(s);if(o!==0){const a=Jh.getComponent(s);tu.multiplyMatrices(n.bones[a].matrixWorld,n.boneInverses[a]),e.addScaledVector(cv.copy(Zh).applyMatrix4(tu),o)}}return e.applyMatrix4(this.bindMatrixInverse)}}class R0 extends _e{constructor(){super(),this.isBone=!0,this.type="Bone"}}class El extends Ke{constructor(t=null,e=1,n=1,i,s,o,a,c,l=en,h=en,d,f){super(null,o,a,c,l,h,i,s,d,f),this.isDataTexture=!0,this.image={data:t,width:e,height:n},this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1}}const iu=new Dt,lv=new Dt;class Al{constructor(t=[],e=[]){this.uuid=$n(),this.bones=t.slice(0),this.boneInverses=e,this.boneMatrices=null,this.boneTexture=null,this.init()}init(){const t=this.bones,e=this.boneInverses;if(this.boneMatrices=new Float32Array(t.length*16),e.length===0)this.calculateInverses();else if(t.length!==e.length){console.warn("THREE.Skeleton: Number of inverse bone matrices does not match amount of bones."),this.boneInverses=[];for(let n=0,i=this.bones.length;n<i;n++)this.boneInverses.push(new Dt)}}calculateInverses(){this.boneInverses.length=0;for(let t=0,e=this.bones.length;t<e;t++){const n=new Dt;this.bones[t]&&n.copy(this.bones[t].matrixWorld).invert(),this.boneInverses.push(n)}}pose(){for(let t=0,e=this.bones.length;t<e;t++){const n=this.bones[t];n&&n.matrixWorld.copy(this.boneInverses[t]).invert()}for(let t=0,e=this.bones.length;t<e;t++){const n=this.bones[t];n&&(n.parent&&n.parent.isBone?(n.matrix.copy(n.parent.matrixWorld).invert(),n.matrix.multiply(n.matrixWorld)):n.matrix.copy(n.matrixWorld),n.matrix.decompose(n.position,n.quaternion,n.scale))}}update(){const t=this.bones,e=this.boneInverses,n=this.boneMatrices,i=this.boneTexture;for(let s=0,o=t.length;s<o;s++){const a=t[s]?t[s].matrixWorld:lv;iu.multiplyMatrices(a,e[s]),iu.toArray(n,s*16)}i!==null&&(i.needsUpdate=!0)}clone(){return new Al(this.bones,this.boneInverses)}computeBoneTexture(){let t=Math.sqrt(this.bones.length*4);t=Math.ceil(t/4)*4,t=Math.max(t,4);const e=new Float32Array(t*t*4);e.set(this.boneMatrices);const n=new El(e,t,t,Sn,fn);return n.needsUpdate=!0,this.boneMatrices=e,this.boneTexture=n,this}getBoneByName(t){for(let e=0,n=this.bones.length;e<n;e++){const i=this.bones[e];if(i.name===t)return i}}dispose(){this.boneTexture!==null&&(this.boneTexture.dispose(),this.boneTexture=null)}fromJSON(t,e){this.uuid=t.uuid;for(let n=0,i=t.bones.length;n<i;n++){const s=t.bones[n];let o=e[s];o===void 0&&(console.warn("THREE.Skeleton: No bone found with UUID:",s),o=new R0),this.bones.push(o),this.boneInverses.push(new Dt().fromArray(t.boneInverses[n]))}return this.init(),this}toJSON(){const t={metadata:{version:4.6,type:"Skeleton",generator:"Skeleton.toJSON"},bones:[],boneInverses:[]};t.uuid=this.uuid;const e=this.bones,n=this.boneInverses;for(let i=0,s=e.length;i<s;i++){const o=e[i];t.bones.push(o.uuid);const a=n[i];t.boneInverses.push(a.toArray())}return t}}class qo extends te{constructor(t,e,n,i=1){super(t,e,n),this.isInstancedBufferAttribute=!0,this.meshPerAttribute=i}copy(t){return super.copy(t),this.meshPerAttribute=t.meshPerAttribute,this}toJSON(){const t=super.toJSON();return t.meshPerAttribute=this.meshPerAttribute,t.isInstancedBufferAttribute=!0,t}}const Es=new Dt,su=new Dt,lo=[],ru=new Vi,hv=new Dt,cr=new Ht,lr=new ni;class Ii extends Ht{constructor(t,e,n){super(t,e),this.isInstancedMesh=!0,this.instanceMatrix=new qo(new Float32Array(n*16),16),this.instanceColor=null,this.morphTexture=null,this.count=n,this.boundingBox=null,this.boundingSphere=null;for(let i=0;i<n;i++)this.setMatrixAt(i,hv)}computeBoundingBox(){const t=this.geometry,e=this.count;this.boundingBox===null&&(this.boundingBox=new Vi),t.boundingBox===null&&t.computeBoundingBox(),this.boundingBox.makeEmpty();for(let n=0;n<e;n++)this.getMatrixAt(n,Es),ru.copy(t.boundingBox).applyMatrix4(Es),this.boundingBox.union(ru)}computeBoundingSphere(){const t=this.geometry,e=this.count;this.boundingSphere===null&&(this.boundingSphere=new ni),t.boundingSphere===null&&t.computeBoundingSphere(),this.boundingSphere.makeEmpty();for(let n=0;n<e;n++)this.getMatrixAt(n,Es),lr.copy(t.boundingSphere).applyMatrix4(Es),this.boundingSphere.union(lr)}copy(t,e){return super.copy(t,e),this.instanceMatrix.copy(t.instanceMatrix),t.morphTexture!==null&&(this.morphTexture=t.morphTexture.clone()),t.instanceColor!==null&&(this.instanceColor=t.instanceColor.clone()),this.count=t.count,t.boundingBox!==null&&(this.boundingBox=t.boundingBox.clone()),t.boundingSphere!==null&&(this.boundingSphere=t.boundingSphere.clone()),this}getColorAt(t,e){e.fromArray(this.instanceColor.array,t*3)}getMatrixAt(t,e){e.fromArray(this.instanceMatrix.array,t*16)}getMorphAt(t,e){const n=e.morphTargetInfluences,i=this.morphTexture.source.data.data,s=n.length+1,o=t*s+1;for(let a=0;a<n.length;a++)n[a]=i[o+a]}raycast(t,e){const n=this.matrixWorld,i=this.count;if(cr.geometry=this.geometry,cr.material=this.material,cr.material!==void 0&&(this.boundingSphere===null&&this.computeBoundingSphere(),lr.copy(this.boundingSphere),lr.applyMatrix4(n),t.ray.intersectsSphere(lr)!==!1))for(let s=0;s<i;s++){this.getMatrixAt(s,Es),su.multiplyMatrices(n,Es),cr.matrixWorld=su,cr.raycast(t,lo);for(let o=0,a=lo.length;o<a;o++){const c=lo[o];c.instanceId=s,c.object=this,e.push(c)}lo.length=0}}setColorAt(t,e){this.instanceColor===null&&(this.instanceColor=new qo(new Float32Array(this.instanceMatrix.count*3).fill(1),3)),e.toArray(this.instanceColor.array,t*3)}setMatrixAt(t,e){e.toArray(this.instanceMatrix.array,t*16)}setMorphAt(t,e){const n=e.morphTargetInfluences,i=n.length+1;this.morphTexture===null&&(this.morphTexture=new El(new Float32Array(i*this.count),i,this.count,ml,fn));const s=this.morphTexture.source.data.data;let o=0;for(let l=0;l<n.length;l++)o+=n[l];const a=this.geometry.morphTargetsRelative?1:1-o,c=i*t;s[c]=a,s.set(n,c+1)}updateMorphTargets(){}dispose(){return this.dispatchEvent({type:"dispose"}),this.morphTexture!==null&&(this.morphTexture.dispose(),this.morphTexture=null),this}}class C0 extends Gi{constructor(t){super(),this.isLineBasicMaterial=!0,this.type="LineBasicMaterial",this.color=new dt(16777215),this.map=null,this.linewidth=1,this.linecap="round",this.linejoin="round",this.fog=!0,this.setValues(t)}copy(t){return super.copy(t),this.color.copy(t.color),this.map=t.map,this.linewidth=t.linewidth,this.linecap=t.linecap,this.linejoin=t.linejoin,this.fog=t.fog,this}}const Xo=new A,jo=new A,ou=new Dt,hr=new ta,ho=new ni,Xa=new A,au=new A;class uv extends _e{constructor(t=new ge,e=new C0){super(),this.isLine=!0,this.type="Line",this.geometry=t,this.material=e,this.updateMorphTargets()}copy(t,e){return super.copy(t,e),this.material=Array.isArray(t.material)?t.material.slice():t.material,this.geometry=t.geometry,this}computeLineDistances(){const t=this.geometry;if(t.index===null){const e=t.attributes.position,n=[0];for(let i=1,s=e.count;i<s;i++)Xo.fromBufferAttribute(e,i-1),jo.fromBufferAttribute(e,i),n[i]=n[i-1],n[i]+=Xo.distanceTo(jo);t.setAttribute("lineDistance",new $t(n,1))}else console.warn("THREE.Line.computeLineDistances(): Computation only possible with non-indexed BufferGeometry.");return this}raycast(t,e){const n=this.geometry,i=this.matrixWorld,s=t.params.Line.threshold,o=n.drawRange;if(n.boundingSphere===null&&n.computeBoundingSphere(),ho.copy(n.boundingSphere),ho.applyMatrix4(i),ho.radius+=s,t.ray.intersectsSphere(ho)===!1)return;ou.copy(i).invert(),hr.copy(t.ray).applyMatrix4(ou);const a=s/((this.scale.x+this.scale.y+this.scale.z)/3),c=a*a,l=this.isLineSegments?2:1,h=n.index,f=n.attributes.position;if(h!==null){const u=Math.max(0,o.start),m=Math.min(h.count,o.start+o.count);for(let v=u,p=m-1;v<p;v+=l){const g=h.getX(v),x=h.getX(v+1),_=uo(this,t,hr,c,g,x);_&&e.push(_)}if(this.isLineLoop){const v=h.getX(m-1),p=h.getX(u),g=uo(this,t,hr,c,v,p);g&&e.push(g)}}else{const u=Math.max(0,o.start),m=Math.min(f.count,o.start+o.count);for(let v=u,p=m-1;v<p;v+=l){const g=uo(this,t,hr,c,v,v+1);g&&e.push(g)}if(this.isLineLoop){const v=uo(this,t,hr,c,m-1,u);v&&e.push(v)}}}updateMorphTargets(){const e=this.geometry.morphAttributes,n=Object.keys(e);if(n.length>0){const i=e[n[0]];if(i!==void 0){this.morphTargetInfluences=[],this.morphTargetDictionary={};for(let s=0,o=i.length;s<o;s++){const a=i[s].name||String(s);this.morphTargetInfluences.push(0),this.morphTargetDictionary[a]=s}}}}}function uo(r,t,e,n,i,s){const o=r.geometry.attributes.position;if(Xo.fromBufferAttribute(o,i),jo.fromBufferAttribute(o,s),e.distanceSqToSegment(Xo,jo,Xa,au)>n)return;Xa.applyMatrix4(r.matrixWorld);const c=t.ray.origin.distanceTo(Xa);if(!(c<t.near||c>t.far))return{distance:c,point:au.clone().applyMatrix4(r.matrixWorld),index:i,face:null,faceIndex:null,barycoord:null,object:r}}const cu=new A,lu=new A;class dv extends uv{constructor(t,e){super(t,e),this.isLineSegments=!0,this.type="LineSegments"}computeLineDistances(){const t=this.geometry;if(t.index===null){const e=t.attributes.position,n=[];for(let i=0,s=e.count;i<s;i+=2)cu.fromBufferAttribute(e,i),lu.fromBufferAttribute(e,i+1),n[i]=i===0?0:n[i-1],n[i+1]=n[i]+cu.distanceTo(lu);t.setAttribute("lineDistance",new $t(n,1))}else console.warn("THREE.LineSegments.computeLineDistances(): Computation only possible with non-indexed BufferGeometry.");return this}}class fv extends Gi{constructor(t){super(),this.isPointsMaterial=!0,this.type="PointsMaterial",this.color=new dt(16777215),this.map=null,this.alphaMap=null,this.size=1,this.sizeAttenuation=!0,this.fog=!0,this.setValues(t)}copy(t){return super.copy(t),this.color.copy(t.color),this.map=t.map,this.alphaMap=t.alphaMap,this.size=t.size,this.sizeAttenuation=t.sizeAttenuation,this.fog=t.fog,this}}const hu=new Dt,nl=new ta,fo=new ni,po=new A;class P0 extends _e{constructor(t=new ge,e=new fv){super(),this.isPoints=!0,this.type="Points",this.geometry=t,this.material=e,this.updateMorphTargets()}copy(t,e){return super.copy(t,e),this.material=Array.isArray(t.material)?t.material.slice():t.material,this.geometry=t.geometry,this}raycast(t,e){const n=this.geometry,i=this.matrixWorld,s=t.params.Points.threshold,o=n.drawRange;if(n.boundingSphere===null&&n.computeBoundingSphere(),fo.copy(n.boundingSphere),fo.applyMatrix4(i),fo.radius+=s,t.ray.intersectsSphere(fo)===!1)return;hu.copy(i).invert(),nl.copy(t.ray).applyMatrix4(hu);const a=s/((this.scale.x+this.scale.y+this.scale.z)/3),c=a*a,l=n.index,d=n.attributes.position;if(l!==null){const f=Math.max(0,o.start),u=Math.min(l.count,o.start+o.count);for(let m=f,v=u;m<v;m++){const p=l.getX(m);po.fromBufferAttribute(d,p),uu(po,p,c,i,t,e,this)}}else{const f=Math.max(0,o.start),u=Math.min(d.count,o.start+o.count);for(let m=f,v=u;m<v;m++)po.fromBufferAttribute(d,m),uu(po,m,c,i,t,e,this)}}updateMorphTargets(){const e=this.geometry.morphAttributes,n=Object.keys(e);if(n.length>0){const i=e[n[0]];if(i!==void 0){this.morphTargetInfluences=[],this.morphTargetDictionary={};for(let s=0,o=i.length;s<o;s++){const a=i[s].name||String(s);this.morphTargetInfluences.push(0),this.morphTargetDictionary[a]=s}}}}}function uu(r,t,e,n,i,s,o){const a=nl.distanceSqToPoint(r);if(a<e){const c=new A;nl.closestPointToPoint(r,c),c.applyMatrix4(n);const l=i.ray.origin.distanceTo(c);if(l<i.near||l>i.far)return;s.push({distance:l,distanceToRay:Math.sqrt(a),point:c,index:t,face:null,faceIndex:null,barycoord:null,object:o})}}class pv extends Ke{constructor(t,e,n,i,s,o,a,c,l){super(t,e,n,i,s,o,a,c,l),this.isCanvasTexture=!0,this.needsUpdate=!0}}class _i{constructor(){this.type="Curve",this.arcLengthDivisions=200}getPoint(){return console.warn("THREE.Curve: .getPoint() not implemented."),null}getPointAt(t,e){const n=this.getUtoTmapping(t);return this.getPoint(n,e)}getPoints(t=5){const e=[];for(let n=0;n<=t;n++)e.push(this.getPoint(n/t));return e}getSpacedPoints(t=5){const e=[];for(let n=0;n<=t;n++)e.push(this.getPointAt(n/t));return e}getLength(){const t=this.getLengths();return t[t.length-1]}getLengths(t=this.arcLengthDivisions){if(this.cacheArcLengths&&this.cacheArcLengths.length===t+1&&!this.needsUpdate)return this.cacheArcLengths;this.needsUpdate=!1;const e=[];let n,i=this.getPoint(0),s=0;e.push(0);for(let o=1;o<=t;o++)n=this.getPoint(o/t),s+=n.distanceTo(i),e.push(s),i=n;return this.cacheArcLengths=e,e}updateArcLengths(){this.needsUpdate=!0,this.getLengths()}getUtoTmapping(t,e){const n=this.getLengths();let i=0;const s=n.length;let o;e?o=e:o=t*n[s-1];let a=0,c=s-1,l;for(;a<=c;)if(i=Math.floor(a+(c-a)/2),l=n[i]-o,l<0)a=i+1;else if(l>0)c=i-1;else{c=i;break}if(i=c,n[i]===o)return i/(s-1);const h=n[i],f=n[i+1]-h,u=(o-h)/f;return(i+u)/(s-1)}getTangent(t,e){let i=t-1e-4,s=t+1e-4;i<0&&(i=0),s>1&&(s=1);const o=this.getPoint(i),a=this.getPoint(s),c=e||(o.isVector2?new ct:new A);return c.copy(a).sub(o).normalize(),c}getTangentAt(t,e){const n=this.getUtoTmapping(t);return this.getTangent(n,e)}computeFrenetFrames(t,e){const n=new A,i=[],s=[],o=[],a=new A,c=new Dt;for(let u=0;u<=t;u++){const m=u/t;i[u]=this.getTangentAt(m,new A)}s[0]=new A,o[0]=new A;let l=Number.MAX_VALUE;const h=Math.abs(i[0].x),d=Math.abs(i[0].y),f=Math.abs(i[0].z);h<=l&&(l=h,n.set(1,0,0)),d<=l&&(l=d,n.set(0,1,0)),f<=l&&n.set(0,0,1),a.crossVectors(i[0],n).normalize(),s[0].crossVectors(i[0],a),o[0].crossVectors(i[0],s[0]);for(let u=1;u<=t;u++){if(s[u]=s[u-1].clone(),o[u]=o[u-1].clone(),a.crossVectors(i[u-1],i[u]),a.length()>Number.EPSILON){a.normalize();const m=Math.acos(He(i[u-1].dot(i[u]),-1,1));s[u].applyMatrix4(c.makeRotationAxis(a,m))}o[u].crossVectors(i[u],s[u])}if(e===!0){let u=Math.acos(He(s[0].dot(s[t]),-1,1));u/=t,i[0].dot(a.crossVectors(s[0],s[t]))>0&&(u=-u);for(let m=1;m<=t;m++)s[m].applyMatrix4(c.makeRotationAxis(i[m],u*m)),o[m].crossVectors(i[m],s[m])}return{tangents:i,normals:s,binormals:o}}clone(){return new this.constructor().copy(this)}copy(t){return this.arcLengthDivisions=t.arcLengthDivisions,this}toJSON(){const t={metadata:{version:4.6,type:"Curve",generator:"Curve.toJSON"}};return t.arcLengthDivisions=this.arcLengthDivisions,t.type=this.type,t}fromJSON(t){return this.arcLengthDivisions=t.arcLengthDivisions,this}}class L0 extends _i{constructor(t=0,e=0,n=1,i=1,s=0,o=Math.PI*2,a=!1,c=0){super(),this.isEllipseCurve=!0,this.type="EllipseCurve",this.aX=t,this.aY=e,this.xRadius=n,this.yRadius=i,this.aStartAngle=s,this.aEndAngle=o,this.aClockwise=a,this.aRotation=c}getPoint(t,e=new ct){const n=e,i=Math.PI*2;let s=this.aEndAngle-this.aStartAngle;const o=Math.abs(s)<Number.EPSILON;for(;s<0;)s+=i;for(;s>i;)s-=i;s<Number.EPSILON&&(o?s=0:s=i),this.aClockwise===!0&&!o&&(s===i?s=-i:s=s-i);const a=this.aStartAngle+t*s;let c=this.aX+this.xRadius*Math.cos(a),l=this.aY+this.yRadius*Math.sin(a);if(this.aRotation!==0){const h=Math.cos(this.aRotation),d=Math.sin(this.aRotation),f=c-this.aX,u=l-this.aY;c=f*h-u*d+this.aX,l=f*d+u*h+this.aY}return n.set(c,l)}copy(t){return super.copy(t),this.aX=t.aX,this.aY=t.aY,this.xRadius=t.xRadius,this.yRadius=t.yRadius,this.aStartAngle=t.aStartAngle,this.aEndAngle=t.aEndAngle,this.aClockwise=t.aClockwise,this.aRotation=t.aRotation,this}toJSON(){const t=super.toJSON();return t.aX=this.aX,t.aY=this.aY,t.xRadius=this.xRadius,t.yRadius=this.yRadius,t.aStartAngle=this.aStartAngle,t.aEndAngle=this.aEndAngle,t.aClockwise=this.aClockwise,t.aRotation=this.aRotation,t}fromJSON(t){return super.fromJSON(t),this.aX=t.aX,this.aY=t.aY,this.xRadius=t.xRadius,this.yRadius=t.yRadius,this.aStartAngle=t.aStartAngle,this.aEndAngle=t.aEndAngle,this.aClockwise=t.aClockwise,this.aRotation=t.aRotation,this}}class mv extends L0{constructor(t,e,n,i,s,o){super(t,e,n,n,i,s,o),this.isArcCurve=!0,this.type="ArcCurve"}}function Rl(){let r=0,t=0,e=0,n=0;function i(s,o,a,c){r=s,t=a,e=-3*s+3*o-2*a-c,n=2*s-2*o+a+c}return{initCatmullRom:function(s,o,a,c,l){i(o,a,l*(a-s),l*(c-o))},initNonuniformCatmullRom:function(s,o,a,c,l,h,d){let f=(o-s)/l-(a-s)/(l+h)+(a-o)/h,u=(a-o)/h-(c-o)/(h+d)+(c-a)/d;f*=h,u*=h,i(o,a,f,u)},calc:function(s){const o=s*s,a=o*s;return r+t*s+e*o+n*a}}}const mo=new A,ja=new Rl,Ya=new Rl,$a=new Rl;class Cl extends _i{constructor(t=[],e=!1,n="centripetal",i=.5){super(),this.isCatmullRomCurve3=!0,this.type="CatmullRomCurve3",this.points=t,this.closed=e,this.curveType=n,this.tension=i}getPoint(t,e=new A){const n=e,i=this.points,s=i.length,o=(s-(this.closed?0:1))*t;let a=Math.floor(o),c=o-a;this.closed?a+=a>0?0:(Math.floor(Math.abs(a)/s)+1)*s:c===0&&a===s-1&&(a=s-2,c=1);let l,h;this.closed||a>0?l=i[(a-1)%s]:(mo.subVectors(i[0],i[1]).add(i[0]),l=mo);const d=i[a%s],f=i[(a+1)%s];if(this.closed||a+2<s?h=i[(a+2)%s]:(mo.subVectors(i[s-1],i[s-2]).add(i[s-1]),h=mo),this.curveType==="centripetal"||this.curveType==="chordal"){const u=this.curveType==="chordal"?.5:.25;let m=Math.pow(l.distanceToSquared(d),u),v=Math.pow(d.distanceToSquared(f),u),p=Math.pow(f.distanceToSquared(h),u);v<1e-4&&(v=1),m<1e-4&&(m=v),p<1e-4&&(p=v),ja.initNonuniformCatmullRom(l.x,d.x,f.x,h.x,m,v,p),Ya.initNonuniformCatmullRom(l.y,d.y,f.y,h.y,m,v,p),$a.initNonuniformCatmullRom(l.z,d.z,f.z,h.z,m,v,p)}else this.curveType==="catmullrom"&&(ja.initCatmullRom(l.x,d.x,f.x,h.x,this.tension),Ya.initCatmullRom(l.y,d.y,f.y,h.y,this.tension),$a.initCatmullRom(l.z,d.z,f.z,h.z,this.tension));return n.set(ja.calc(c),Ya.calc(c),$a.calc(c)),n}copy(t){super.copy(t),this.points=[];for(let e=0,n=t.points.length;e<n;e++){const i=t.points[e];this.points.push(i.clone())}return this.closed=t.closed,this.curveType=t.curveType,this.tension=t.tension,this}toJSON(){const t=super.toJSON();t.points=[];for(let e=0,n=this.points.length;e<n;e++){const i=this.points[e];t.points.push(i.toArray())}return t.closed=this.closed,t.curveType=this.curveType,t.tension=this.tension,t}fromJSON(t){super.fromJSON(t),this.points=[];for(let e=0,n=t.points.length;e<n;e++){const i=t.points[e];this.points.push(new A().fromArray(i))}return this.closed=t.closed,this.curveType=t.curveType,this.tension=t.tension,this}}function du(r,t,e,n,i){const s=(n-t)*.5,o=(i-e)*.5,a=r*r,c=r*a;return(2*e-2*n+s+o)*c+(-3*e+3*n-2*s-o)*a+s*r+e}function gv(r,t){const e=1-r;return e*e*t}function vv(r,t){return 2*(1-r)*r*t}function xv(r,t){return r*r*t}function Er(r,t,e,n){return gv(r,t)+vv(r,e)+xv(r,n)}function _v(r,t){const e=1-r;return e*e*e*t}function yv(r,t){const e=1-r;return 3*e*e*r*t}function Mv(r,t){return 3*(1-r)*r*r*t}function bv(r,t){return r*r*r*t}function Ar(r,t,e,n,i){return _v(r,t)+yv(r,e)+Mv(r,n)+bv(r,i)}class Sv extends _i{constructor(t=new ct,e=new ct,n=new ct,i=new ct){super(),this.isCubicBezierCurve=!0,this.type="CubicBezierCurve",this.v0=t,this.v1=e,this.v2=n,this.v3=i}getPoint(t,e=new ct){const n=e,i=this.v0,s=this.v1,o=this.v2,a=this.v3;return n.set(Ar(t,i.x,s.x,o.x,a.x),Ar(t,i.y,s.y,o.y,a.y)),n}copy(t){return super.copy(t),this.v0.copy(t.v0),this.v1.copy(t.v1),this.v2.copy(t.v2),this.v3.copy(t.v3),this}toJSON(){const t=super.toJSON();return t.v0=this.v0.toArray(),t.v1=this.v1.toArray(),t.v2=this.v2.toArray(),t.v3=this.v3.toArray(),t}fromJSON(t){return super.fromJSON(t),this.v0.fromArray(t.v0),this.v1.fromArray(t.v1),this.v2.fromArray(t.v2),this.v3.fromArray(t.v3),this}}class wv extends _i{constructor(t=new A,e=new A,n=new A,i=new A){super(),this.isCubicBezierCurve3=!0,this.type="CubicBezierCurve3",this.v0=t,this.v1=e,this.v2=n,this.v3=i}getPoint(t,e=new A){const n=e,i=this.v0,s=this.v1,o=this.v2,a=this.v3;return n.set(Ar(t,i.x,s.x,o.x,a.x),Ar(t,i.y,s.y,o.y,a.y),Ar(t,i.z,s.z,o.z,a.z)),n}copy(t){return super.copy(t),this.v0.copy(t.v0),this.v1.copy(t.v1),this.v2.copy(t.v2),this.v3.copy(t.v3),this}toJSON(){const t=super.toJSON();return t.v0=this.v0.toArray(),t.v1=this.v1.toArray(),t.v2=this.v2.toArray(),t.v3=this.v3.toArray(),t}fromJSON(t){return super.fromJSON(t),this.v0.fromArray(t.v0),this.v1.fromArray(t.v1),this.v2.fromArray(t.v2),this.v3.fromArray(t.v3),this}}class Tv extends _i{constructor(t=new ct,e=new ct){super(),this.isLineCurve=!0,this.type="LineCurve",this.v1=t,this.v2=e}getPoint(t,e=new ct){const n=e;return t===1?n.copy(this.v2):(n.copy(this.v2).sub(this.v1),n.multiplyScalar(t).add(this.v1)),n}getPointAt(t,e){return this.getPoint(t,e)}getTangent(t,e=new ct){return e.subVectors(this.v2,this.v1).normalize()}getTangentAt(t,e){return this.getTangent(t,e)}copy(t){return super.copy(t),this.v1.copy(t.v1),this.v2.copy(t.v2),this}toJSON(){const t=super.toJSON();return t.v1=this.v1.toArray(),t.v2=this.v2.toArray(),t}fromJSON(t){return super.fromJSON(t),this.v1.fromArray(t.v1),this.v2.fromArray(t.v2),this}}class Ev extends _i{constructor(t=new A,e=new A){super(),this.isLineCurve3=!0,this.type="LineCurve3",this.v1=t,this.v2=e}getPoint(t,e=new A){const n=e;return t===1?n.copy(this.v2):(n.copy(this.v2).sub(this.v1),n.multiplyScalar(t).add(this.v1)),n}getPointAt(t,e){return this.getPoint(t,e)}getTangent(t,e=new A){return e.subVectors(this.v2,this.v1).normalize()}getTangentAt(t,e){return this.getTangent(t,e)}copy(t){return super.copy(t),this.v1.copy(t.v1),this.v2.copy(t.v2),this}toJSON(){const t=super.toJSON();return t.v1=this.v1.toArray(),t.v2=this.v2.toArray(),t}fromJSON(t){return super.fromJSON(t),this.v1.fromArray(t.v1),this.v2.fromArray(t.v2),this}}class Av extends _i{constructor(t=new ct,e=new ct,n=new ct){super(),this.isQuadraticBezierCurve=!0,this.type="QuadraticBezierCurve",this.v0=t,this.v1=e,this.v2=n}getPoint(t,e=new ct){const n=e,i=this.v0,s=this.v1,o=this.v2;return n.set(Er(t,i.x,s.x,o.x),Er(t,i.y,s.y,o.y)),n}copy(t){return super.copy(t),this.v0.copy(t.v0),this.v1.copy(t.v1),this.v2.copy(t.v2),this}toJSON(){const t=super.toJSON();return t.v0=this.v0.toArray(),t.v1=this.v1.toArray(),t.v2=this.v2.toArray(),t}fromJSON(t){return super.fromJSON(t),this.v0.fromArray(t.v0),this.v1.fromArray(t.v1),this.v2.fromArray(t.v2),this}}class k0 extends _i{constructor(t=new A,e=new A,n=new A){super(),this.isQuadraticBezierCurve3=!0,this.type="QuadraticBezierCurve3",this.v0=t,this.v1=e,this.v2=n}getPoint(t,e=new A){const n=e,i=this.v0,s=this.v1,o=this.v2;return n.set(Er(t,i.x,s.x,o.x),Er(t,i.y,s.y,o.y),Er(t,i.z,s.z,o.z)),n}copy(t){return super.copy(t),this.v0.copy(t.v0),this.v1.copy(t.v1),this.v2.copy(t.v2),this}toJSON(){const t=super.toJSON();return t.v0=this.v0.toArray(),t.v1=this.v1.toArray(),t.v2=this.v2.toArray(),t}fromJSON(t){return super.fromJSON(t),this.v0.fromArray(t.v0),this.v1.fromArray(t.v1),this.v2.fromArray(t.v2),this}}class Rv extends _i{constructor(t=[]){super(),this.isSplineCurve=!0,this.type="SplineCurve",this.points=t}getPoint(t,e=new ct){const n=e,i=this.points,s=(i.length-1)*t,o=Math.floor(s),a=s-o,c=i[o===0?o:o-1],l=i[o],h=i[o>i.length-2?i.length-1:o+1],d=i[o>i.length-3?i.length-1:o+2];return n.set(du(a,c.x,l.x,h.x,d.x),du(a,c.y,l.y,h.y,d.y)),n}copy(t){super.copy(t),this.points=[];for(let e=0,n=t.points.length;e<n;e++){const i=t.points[e];this.points.push(i.clone())}return this}toJSON(){const t=super.toJSON();t.points=[];for(let e=0,n=this.points.length;e<n;e++){const i=this.points[e];t.points.push(i.toArray())}return t}fromJSON(t){super.fromJSON(t),this.points=[];for(let e=0,n=t.points.length;e<n;e++){const i=t.points[e];this.points.push(new ct().fromArray(i))}return this}}var Cv=Object.freeze({__proto__:null,ArcCurve:mv,CatmullRomCurve3:Cl,CubicBezierCurve:Sv,CubicBezierCurve3:wv,EllipseCurve:L0,LineCurve:Tv,LineCurve3:Ev,QuadraticBezierCurve:Av,QuadraticBezierCurve3:k0,SplineCurve:Rv});class fi extends ge{constructor(t=[new ct(0,-.5),new ct(.5,0),new ct(0,.5)],e=12,n=0,i=Math.PI*2){super(),this.type="LatheGeometry",this.parameters={points:t,segments:e,phiStart:n,phiLength:i},e=Math.floor(e),i=He(i,0,Math.PI*2);const s=[],o=[],a=[],c=[],l=[],h=1/e,d=new A,f=new ct,u=new A,m=new A,v=new A;let p=0,g=0;for(let x=0;x<=t.length-1;x++)switch(x){case 0:p=t[x+1].x-t[x].x,g=t[x+1].y-t[x].y,u.x=g*1,u.y=-p,u.z=g*0,v.copy(u),u.normalize(),c.push(u.x,u.y,u.z);break;case t.length-1:c.push(v.x,v.y,v.z);break;default:p=t[x+1].x-t[x].x,g=t[x+1].y-t[x].y,u.x=g*1,u.y=-p,u.z=g*0,m.copy(u),u.x+=v.x,u.y+=v.y,u.z+=v.z,u.normalize(),c.push(u.x,u.y,u.z),v.copy(m)}for(let x=0;x<=e;x++){const _=n+x*h*i,y=Math.sin(_),w=Math.cos(_);for(let T=0;T<=t.length-1;T++){d.x=t[T].x*y,d.y=t[T].y,d.z=t[T].x*w,o.push(d.x,d.y,d.z),f.x=x/e,f.y=T/(t.length-1),a.push(f.x,f.y);const R=c[3*T+0]*y,E=c[3*T+1],D=c[3*T+0]*w;l.push(R,E,D)}}for(let x=0;x<e;x++)for(let _=0;_<t.length-1;_++){const y=_+x*t.length,w=y,T=y+t.length,R=y+t.length+1,E=y+1;s.push(w,T,E),s.push(R,E,T)}this.setIndex(s),this.setAttribute("position",new $t(o,3)),this.setAttribute("uv",new $t(a,2)),this.setAttribute("normal",new $t(l,3))}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}static fromJSON(t){return new fi(t.points,t.segments,t.phiStart,t.phiLength)}}class Yo extends ge{constructor(t=1,e=32,n=0,i=Math.PI*2){super(),this.type="CircleGeometry",this.parameters={radius:t,segments:e,thetaStart:n,thetaLength:i},e=Math.max(3,e);const s=[],o=[],a=[],c=[],l=new A,h=new ct;o.push(0,0,0),a.push(0,0,1),c.push(.5,.5);for(let d=0,f=3;d<=e;d++,f+=3){const u=n+d/e*i;l.x=t*Math.cos(u),l.y=t*Math.sin(u),o.push(l.x,l.y,l.z),a.push(0,0,1),h.x=(o[f]/t+1)/2,h.y=(o[f+1]/t+1)/2,c.push(h.x,h.y)}for(let d=1;d<=e;d++)s.push(d,d+1,0);this.setIndex(s),this.setAttribute("position",new $t(o,3)),this.setAttribute("normal",new $t(a,3)),this.setAttribute("uv",new $t(c,2))}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}static fromJSON(t){return new Yo(t.radius,t.segments,t.thetaStart,t.thetaLength)}}class ia extends ge{constructor(t=1,e=1,n=1,i=32,s=1,o=!1,a=0,c=Math.PI*2){super(),this.type="CylinderGeometry",this.parameters={radiusTop:t,radiusBottom:e,height:n,radialSegments:i,heightSegments:s,openEnded:o,thetaStart:a,thetaLength:c};const l=this;i=Math.floor(i),s=Math.floor(s);const h=[],d=[],f=[],u=[];let m=0;const v=[],p=n/2;let g=0;x(),o===!1&&(t>0&&_(!0),e>0&&_(!1)),this.setIndex(h),this.setAttribute("position",new $t(d,3)),this.setAttribute("normal",new $t(f,3)),this.setAttribute("uv",new $t(u,2));function x(){const y=new A,w=new A;let T=0;const R=(e-t)/n;for(let E=0;E<=s;E++){const D=[],M=E/s,S=M*(e-t)+t;for(let k=0;k<=i;k++){const N=k/i,z=N*c+a,H=Math.sin(z),L=Math.cos(z);w.x=S*H,w.y=-M*n+p,w.z=S*L,d.push(w.x,w.y,w.z),y.set(H,R,L).normalize(),f.push(y.x,y.y,y.z),u.push(N,1-M),D.push(m++)}v.push(D)}for(let E=0;E<i;E++)for(let D=0;D<s;D++){const M=v[D][E],S=v[D+1][E],k=v[D+1][E+1],N=v[D][E+1];t>0&&(h.push(M,S,N),T+=3),e>0&&(h.push(S,k,N),T+=3)}l.addGroup(g,T,0),g+=T}function _(y){const w=m,T=new ct,R=new A;let E=0;const D=y===!0?t:e,M=y===!0?1:-1;for(let k=1;k<=i;k++)d.push(0,p*M,0),f.push(0,M,0),u.push(.5,.5),m++;const S=m;for(let k=0;k<=i;k++){const z=k/i*c+a,H=Math.cos(z),L=Math.sin(z);R.x=D*L,R.y=p*M,R.z=D*H,d.push(R.x,R.y,R.z),f.push(0,M,0),T.x=H*.5+.5,T.y=L*.5*M+.5,u.push(T.x,T.y),m++}for(let k=0;k<i;k++){const N=w+k,z=S+k;y===!0?h.push(z,z+1,N):h.push(z+1,z,N),E+=3}l.addGroup(g,E,y===!0?1:2),g+=E}}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}static fromJSON(t){return new ia(t.radiusTop,t.radiusBottom,t.height,t.radialSegments,t.heightSegments,t.openEnded,t.thetaStart,t.thetaLength)}}class Rr extends ia{constructor(t=1,e=1,n=32,i=1,s=!1,o=0,a=Math.PI*2){super(0,t,e,n,i,s,o,a),this.type="ConeGeometry",this.parameters={radius:t,height:e,radialSegments:n,heightSegments:i,openEnded:s,thetaStart:o,thetaLength:a}}static fromJSON(t){return new Rr(t.radius,t.height,t.radialSegments,t.heightSegments,t.openEnded,t.thetaStart,t.thetaLength)}}class Pl extends ge{constructor(t=[],e=[],n=1,i=0){super(),this.type="PolyhedronGeometry",this.parameters={vertices:t,indices:e,radius:n,detail:i};const s=[],o=[];a(i),l(n),h(),this.setAttribute("position",new $t(s,3)),this.setAttribute("normal",new $t(s.slice(),3)),this.setAttribute("uv",new $t(o,2)),i===0?this.computeVertexNormals():this.normalizeNormals();function a(x){const _=new A,y=new A,w=new A;for(let T=0;T<e.length;T+=3)u(e[T+0],_),u(e[T+1],y),u(e[T+2],w),c(_,y,w,x)}function c(x,_,y,w){const T=w+1,R=[];for(let E=0;E<=T;E++){R[E]=[];const D=x.clone().lerp(y,E/T),M=_.clone().lerp(y,E/T),S=T-E;for(let k=0;k<=S;k++)k===0&&E===T?R[E][k]=D:R[E][k]=D.clone().lerp(M,k/S)}for(let E=0;E<T;E++)for(let D=0;D<2*(T-E)-1;D++){const M=Math.floor(D/2);D%2===0?(f(R[E][M+1]),f(R[E+1][M]),f(R[E][M])):(f(R[E][M+1]),f(R[E+1][M+1]),f(R[E+1][M]))}}function l(x){const _=new A;for(let y=0;y<s.length;y+=3)_.x=s[y+0],_.y=s[y+1],_.z=s[y+2],_.normalize().multiplyScalar(x),s[y+0]=_.x,s[y+1]=_.y,s[y+2]=_.z}function h(){const x=new A;for(let _=0;_<s.length;_+=3){x.x=s[_+0],x.y=s[_+1],x.z=s[_+2];const y=p(x)/2/Math.PI+.5,w=g(x)/Math.PI+.5;o.push(y,1-w)}m(),d()}function d(){for(let x=0;x<o.length;x+=6){const _=o[x+0],y=o[x+2],w=o[x+4],T=Math.max(_,y,w),R=Math.min(_,y,w);T>.9&&R<.1&&(_<.2&&(o[x+0]+=1),y<.2&&(o[x+2]+=1),w<.2&&(o[x+4]+=1))}}function f(x){s.push(x.x,x.y,x.z)}function u(x,_){const y=x*3;_.x=t[y+0],_.y=t[y+1],_.z=t[y+2]}function m(){const x=new A,_=new A,y=new A,w=new A,T=new ct,R=new ct,E=new ct;for(let D=0,M=0;D<s.length;D+=9,M+=6){x.set(s[D+0],s[D+1],s[D+2]),_.set(s[D+3],s[D+4],s[D+5]),y.set(s[D+6],s[D+7],s[D+8]),T.set(o[M+0],o[M+1]),R.set(o[M+2],o[M+3]),E.set(o[M+4],o[M+5]),w.copy(x).add(_).add(y).divideScalar(3);const S=p(w);v(T,M+0,x,S),v(R,M+2,_,S),v(E,M+4,y,S)}}function v(x,_,y,w){w<0&&x.x===1&&(o[_]=x.x-1),y.x===0&&y.z===0&&(o[_]=w/2/Math.PI+.5)}function p(x){return Math.atan2(x.z,-x.x)}function g(x){return Math.atan2(-x.y,Math.sqrt(x.x*x.x+x.z*x.z))}}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}static fromJSON(t){return new Pl(t.vertices,t.indices,t.radius,t.details)}}class qs extends Pl{constructor(t=1,e=0){const n=(1+Math.sqrt(5))/2,i=[-1,n,0,1,n,0,-1,-n,0,1,-n,0,0,-1,n,0,1,n,0,-1,-n,0,1,-n,n,0,-1,n,0,1,-n,0,-1,-n,0,1],s=[0,11,5,0,5,1,0,1,7,0,7,10,0,10,11,1,5,9,5,11,4,11,10,2,10,7,6,7,1,8,3,9,4,3,4,2,3,2,6,3,6,8,3,8,9,4,9,5,2,4,11,6,2,10,8,6,7,9,8,1];super(i,s,t,e),this.type="IcosahedronGeometry",this.parameters={radius:t,detail:e}}static fromJSON(t){return new qs(t.radius,t.detail)}}class Ll extends ge{constructor(t=.5,e=1,n=32,i=1,s=0,o=Math.PI*2){super(),this.type="RingGeometry",this.parameters={innerRadius:t,outerRadius:e,thetaSegments:n,phiSegments:i,thetaStart:s,thetaLength:o},n=Math.max(3,n),i=Math.max(1,i);const a=[],c=[],l=[],h=[];let d=t;const f=(e-t)/i,u=new A,m=new ct;for(let v=0;v<=i;v++){for(let p=0;p<=n;p++){const g=s+p/n*o;u.x=d*Math.cos(g),u.y=d*Math.sin(g),c.push(u.x,u.y,u.z),l.push(0,0,1),m.x=(u.x/e+1)/2,m.y=(u.y/e+1)/2,h.push(m.x,m.y)}d+=f}for(let v=0;v<i;v++){const p=v*(n+1);for(let g=0;g<n;g++){const x=g+p,_=x,y=x+n+1,w=x+n+2,T=x+1;a.push(_,y,T),a.push(y,w,T)}}this.setIndex(a),this.setAttribute("position",new $t(c,3)),this.setAttribute("normal",new $t(l,3)),this.setAttribute("uv",new $t(h,2))}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}static fromJSON(t){return new Ll(t.innerRadius,t.outerRadius,t.thetaSegments,t.phiSegments,t.thetaStart,t.thetaLength)}}class Xe extends ge{constructor(t=1,e=32,n=16,i=0,s=Math.PI*2,o=0,a=Math.PI){super(),this.type="SphereGeometry",this.parameters={radius:t,widthSegments:e,heightSegments:n,phiStart:i,phiLength:s,thetaStart:o,thetaLength:a},e=Math.max(3,Math.floor(e)),n=Math.max(2,Math.floor(n));const c=Math.min(o+a,Math.PI);let l=0;const h=[],d=new A,f=new A,u=[],m=[],v=[],p=[];for(let g=0;g<=n;g++){const x=[],_=g/n;let y=0;g===0&&o===0?y=.5/e:g===n&&c===Math.PI&&(y=-.5/e);for(let w=0;w<=e;w++){const T=w/e;d.x=-t*Math.cos(i+T*s)*Math.sin(o+_*a),d.y=t*Math.cos(o+_*a),d.z=t*Math.sin(i+T*s)*Math.sin(o+_*a),m.push(d.x,d.y,d.z),f.copy(d).normalize(),v.push(f.x,f.y,f.z),p.push(T+y,1-_),x.push(l++)}h.push(x)}for(let g=0;g<n;g++)for(let x=0;x<e;x++){const _=h[g][x+1],y=h[g][x],w=h[g+1][x],T=h[g+1][x+1];(g!==0||o>0)&&u.push(_,y,T),(g!==n-1||c<Math.PI)&&u.push(y,w,T)}this.setIndex(u),this.setAttribute("position",new $t(m,3)),this.setAttribute("normal",new $t(v,3)),this.setAttribute("uv",new $t(p,2))}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}static fromJSON(t){return new Xe(t.radius,t.widthSegments,t.heightSegments,t.phiStart,t.phiLength,t.thetaStart,t.thetaLength)}}class Is extends ge{constructor(t=1,e=.4,n=12,i=48,s=Math.PI*2){super(),this.type="TorusGeometry",this.parameters={radius:t,tube:e,radialSegments:n,tubularSegments:i,arc:s},n=Math.floor(n),i=Math.floor(i);const o=[],a=[],c=[],l=[],h=new A,d=new A,f=new A;for(let u=0;u<=n;u++)for(let m=0;m<=i;m++){const v=m/i*s,p=u/n*Math.PI*2;d.x=(t+e*Math.cos(p))*Math.cos(v),d.y=(t+e*Math.cos(p))*Math.sin(v),d.z=e*Math.sin(p),a.push(d.x,d.y,d.z),h.x=t*Math.cos(v),h.y=t*Math.sin(v),f.subVectors(d,h).normalize(),c.push(f.x,f.y,f.z),l.push(m/i),l.push(u/n)}for(let u=1;u<=n;u++)for(let m=1;m<=i;m++){const v=(i+1)*u+m-1,p=(i+1)*(u-1)+m-1,g=(i+1)*(u-1)+m,x=(i+1)*u+m;o.push(v,p,x),o.push(p,g,x)}this.setIndex(o),this.setAttribute("position",new $t(a,3)),this.setAttribute("normal",new $t(c,3)),this.setAttribute("uv",new $t(l,2))}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}static fromJSON(t){return new Is(t.radius,t.tube,t.radialSegments,t.tubularSegments,t.arc)}}class sa extends ge{constructor(t=new k0(new A(-1,-1,0),new A(-1,1,0),new A(1,1,0)),e=64,n=1,i=8,s=!1){super(),this.type="TubeGeometry",this.parameters={path:t,tubularSegments:e,radius:n,radialSegments:i,closed:s};const o=t.computeFrenetFrames(e,s);this.tangents=o.tangents,this.normals=o.normals,this.binormals=o.binormals;const a=new A,c=new A,l=new ct;let h=new A;const d=[],f=[],u=[],m=[];v(),this.setIndex(m),this.setAttribute("position",new $t(d,3)),this.setAttribute("normal",new $t(f,3)),this.setAttribute("uv",new $t(u,2));function v(){for(let _=0;_<e;_++)p(_);p(s===!1?e:0),x(),g()}function p(_){h=t.getPointAt(_/e,h);const y=o.normals[_],w=o.binormals[_];for(let T=0;T<=i;T++){const R=T/i*Math.PI*2,E=Math.sin(R),D=-Math.cos(R);c.x=D*y.x+E*w.x,c.y=D*y.y+E*w.y,c.z=D*y.z+E*w.z,c.normalize(),f.push(c.x,c.y,c.z),a.x=h.x+n*c.x,a.y=h.y+n*c.y,a.z=h.z+n*c.z,d.push(a.x,a.y,a.z)}}function g(){for(let _=1;_<=e;_++)for(let y=1;y<=i;y++){const w=(i+1)*(_-1)+(y-1),T=(i+1)*_+(y-1),R=(i+1)*_+y,E=(i+1)*(_-1)+y;m.push(w,T,E),m.push(T,R,E)}}function x(){for(let _=0;_<=e;_++)for(let y=0;y<=i;y++)l.x=_/e,l.y=y/i,u.push(l.x,l.y)}}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}toJSON(){const t=super.toJSON();return t.path=this.parameters.path.toJSON(),t}static fromJSON(t){return new sa(new Cv[t.path.type]().fromJSON(t.path),t.tubularSegments,t.radius,t.radialSegments,t.closed)}}class de extends Gi{constructor(t){super(),this.isMeshStandardMaterial=!0,this.defines={STANDARD:""},this.type="MeshStandardMaterial",this.color=new dt(16777215),this.roughness=1,this.metalness=0,this.map=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.emissive=new dt(0),this.emissiveIntensity=1,this.emissiveMap=null,this.bumpMap=null,this.bumpScale=1,this.normalMap=null,this.normalMapType=o0,this.normalScale=new ct(1,1),this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.roughnessMap=null,this.metalnessMap=null,this.alphaMap=null,this.envMap=null,this.envMapRotation=new Ve,this.envMapIntensity=1,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap="round",this.wireframeLinejoin="round",this.flatShading=!1,this.fog=!0,this.setValues(t)}copy(t){return super.copy(t),this.defines={STANDARD:""},this.color.copy(t.color),this.roughness=t.roughness,this.metalness=t.metalness,this.map=t.map,this.lightMap=t.lightMap,this.lightMapIntensity=t.lightMapIntensity,this.aoMap=t.aoMap,this.aoMapIntensity=t.aoMapIntensity,this.emissive.copy(t.emissive),this.emissiveMap=t.emissiveMap,this.emissiveIntensity=t.emissiveIntensity,this.bumpMap=t.bumpMap,this.bumpScale=t.bumpScale,this.normalMap=t.normalMap,this.normalMapType=t.normalMapType,this.normalScale.copy(t.normalScale),this.displacementMap=t.displacementMap,this.displacementScale=t.displacementScale,this.displacementBias=t.displacementBias,this.roughnessMap=t.roughnessMap,this.metalnessMap=t.metalnessMap,this.alphaMap=t.alphaMap,this.envMap=t.envMap,this.envMapRotation.copy(t.envMapRotation),this.envMapIntensity=t.envMapIntensity,this.wireframe=t.wireframe,this.wireframeLinewidth=t.wireframeLinewidth,this.wireframeLinecap=t.wireframeLinecap,this.wireframeLinejoin=t.wireframeLinejoin,this.flatShading=t.flatShading,this.fog=t.fog,this}}class Ns extends de{constructor(t){super(),this.isMeshPhysicalMaterial=!0,this.defines={STANDARD:"",PHYSICAL:""},this.type="MeshPhysicalMaterial",this.anisotropyRotation=0,this.anisotropyMap=null,this.clearcoatMap=null,this.clearcoatRoughness=0,this.clearcoatRoughnessMap=null,this.clearcoatNormalScale=new ct(1,1),this.clearcoatNormalMap=null,this.ior=1.5,Object.defineProperty(this,"reflectivity",{get:function(){return He(2.5*(this.ior-1)/(this.ior+1),0,1)},set:function(e){this.ior=(1+.4*e)/(1-.4*e)}}),this.iridescenceMap=null,this.iridescenceIOR=1.3,this.iridescenceThicknessRange=[100,400],this.iridescenceThicknessMap=null,this.sheenColor=new dt(0),this.sheenColorMap=null,this.sheenRoughness=1,this.sheenRoughnessMap=null,this.transmissionMap=null,this.thickness=0,this.thicknessMap=null,this.attenuationDistance=1/0,this.attenuationColor=new dt(1,1,1),this.specularIntensity=1,this.specularIntensityMap=null,this.specularColor=new dt(1,1,1),this.specularColorMap=null,this._anisotropy=0,this._clearcoat=0,this._dispersion=0,this._iridescence=0,this._sheen=0,this._transmission=0,this.setValues(t)}get anisotropy(){return this._anisotropy}set anisotropy(t){this._anisotropy>0!=t>0&&this.version++,this._anisotropy=t}get clearcoat(){return this._clearcoat}set clearcoat(t){this._clearcoat>0!=t>0&&this.version++,this._clearcoat=t}get iridescence(){return this._iridescence}set iridescence(t){this._iridescence>0!=t>0&&this.version++,this._iridescence=t}get dispersion(){return this._dispersion}set dispersion(t){this._dispersion>0!=t>0&&this.version++,this._dispersion=t}get sheen(){return this._sheen}set sheen(t){this._sheen>0!=t>0&&this.version++,this._sheen=t}get transmission(){return this._transmission}set transmission(t){this._transmission>0!=t>0&&this.version++,this._transmission=t}copy(t){return super.copy(t),this.defines={STANDARD:"",PHYSICAL:""},this.anisotropy=t.anisotropy,this.anisotropyRotation=t.anisotropyRotation,this.anisotropyMap=t.anisotropyMap,this.clearcoat=t.clearcoat,this.clearcoatMap=t.clearcoatMap,this.clearcoatRoughness=t.clearcoatRoughness,this.clearcoatRoughnessMap=t.clearcoatRoughnessMap,this.clearcoatNormalMap=t.clearcoatNormalMap,this.clearcoatNormalScale.copy(t.clearcoatNormalScale),this.dispersion=t.dispersion,this.ior=t.ior,this.iridescence=t.iridescence,this.iridescenceMap=t.iridescenceMap,this.iridescenceIOR=t.iridescenceIOR,this.iridescenceThicknessRange=[...t.iridescenceThicknessRange],this.iridescenceThicknessMap=t.iridescenceThicknessMap,this.sheen=t.sheen,this.sheenColor.copy(t.sheenColor),this.sheenColorMap=t.sheenColorMap,this.sheenRoughness=t.sheenRoughness,this.sheenRoughnessMap=t.sheenRoughnessMap,this.transmission=t.transmission,this.transmissionMap=t.transmissionMap,this.thickness=t.thickness,this.thicknessMap=t.thicknessMap,this.attenuationDistance=t.attenuationDistance,this.attenuationColor.copy(t.attenuationColor),this.specularIntensity=t.specularIntensity,this.specularIntensityMap=t.specularIntensityMap,this.specularColor.copy(t.specularColor),this.specularColorMap=t.specularColorMap,this}}const fu={enabled:!1,files:{},add:function(r,t){this.enabled!==!1&&(this.files[r]=t)},get:function(r){if(this.enabled!==!1)return this.files[r]},remove:function(r){delete this.files[r]},clear:function(){this.files={}}};class D0{constructor(t,e,n){const i=this;let s=!1,o=0,a=0,c;const l=[];this.onStart=void 0,this.onLoad=t,this.onProgress=e,this.onError=n,this.itemStart=function(h){a++,s===!1&&i.onStart!==void 0&&i.onStart(h,o,a),s=!0},this.itemEnd=function(h){o++,i.onProgress!==void 0&&i.onProgress(h,o,a),o===a&&(s=!1,i.onLoad!==void 0&&i.onLoad())},this.itemError=function(h){i.onError!==void 0&&i.onError(h)},this.resolveURL=function(h){return c?c(h):h},this.setURLModifier=function(h){return c=h,this},this.addHandler=function(h,d){return l.push(h,d),this},this.removeHandler=function(h){const d=l.indexOf(h);return d!==-1&&l.splice(d,2),this},this.getHandler=function(h){for(let d=0,f=l.length;d<f;d+=2){const u=l[d],m=l[d+1];if(u.global&&(u.lastIndex=0),u.test(h))return m}return null}}}const Pv=new D0;class kl{constructor(t){this.manager=t!==void 0?t:Pv,this.crossOrigin="anonymous",this.withCredentials=!1,this.path="",this.resourcePath="",this.requestHeader={}}load(){}loadAsync(t,e){const n=this;return new Promise(function(i,s){n.load(t,i,e,s)})}parse(){}setCrossOrigin(t){return this.crossOrigin=t,this}setWithCredentials(t){return this.withCredentials=t,this}setPath(t){return this.path=t,this}setResourcePath(t){return this.resourcePath=t,this}setRequestHeader(t){return this.requestHeader=t,this}}kl.DEFAULT_MATERIAL_NAME="__DEFAULT";class Lv extends kl{constructor(t){super(t)}load(t,e,n,i){this.path!==void 0&&(t=this.path+t),t=this.manager.resolveURL(t);const s=this,o=fu.get(t);if(o!==void 0)return s.manager.itemStart(t),setTimeout(function(){e&&e(o),s.manager.itemEnd(t)},0),o;const a=Lr("img");function c(){h(),fu.add(t,this),e&&e(this),s.manager.itemEnd(t)}function l(d){h(),i&&i(d),s.manager.itemError(t),s.manager.itemEnd(t)}function h(){a.removeEventListener("load",c,!1),a.removeEventListener("error",l,!1)}return a.addEventListener("load",c,!1),a.addEventListener("error",l,!1),t.slice(0,5)!=="data:"&&this.crossOrigin!==void 0&&(a.crossOrigin=this.crossOrigin),s.manager.itemStart(t),a.src=t,a}}class kv extends kl{constructor(t){super(t)}load(t,e,n,i){const s=new Ke,o=new Lv(this.manager);return o.setCrossOrigin(this.crossOrigin),o.setPath(this.path),o.load(t,function(a){s.image=a,s.needsUpdate=!0,e!==void 0&&e(s)},n,i),s}}class I0 extends _e{constructor(t,e=1){super(),this.isLight=!0,this.type="Light",this.color=new dt(t),this.intensity=e}dispose(){}copy(t,e){return super.copy(t,e),this.color.copy(t.color),this.intensity=t.intensity,this}toJSON(t){const e=super.toJSON(t);return e.object.color=this.color.getHex(),e.object.intensity=this.intensity,this.groundColor!==void 0&&(e.object.groundColor=this.groundColor.getHex()),this.distance!==void 0&&(e.object.distance=this.distance),this.angle!==void 0&&(e.object.angle=this.angle),this.decay!==void 0&&(e.object.decay=this.decay),this.penumbra!==void 0&&(e.object.penumbra=this.penumbra),this.shadow!==void 0&&(e.object.shadow=this.shadow.toJSON()),this.target!==void 0&&(e.object.target=this.target.uuid),e}}class Dv extends I0{constructor(t,e,n){super(t,n),this.isHemisphereLight=!0,this.type="HemisphereLight",this.position.copy(_e.DEFAULT_UP),this.updateMatrix(),this.groundColor=new dt(e)}copy(t,e){return super.copy(t,e),this.groundColor.copy(t.groundColor),this}}const Ka=new Dt,pu=new A,mu=new A;class Iv{constructor(t){this.camera=t,this.intensity=1,this.bias=0,this.normalBias=0,this.radius=1,this.blurSamples=8,this.mapSize=new ct(512,512),this.map=null,this.mapPass=null,this.matrix=new Dt,this.autoUpdate=!0,this.needsUpdate=!1,this._frustum=new Sl,this._frameExtents=new ct(1,1),this._viewportCount=1,this._viewports=[new we(0,0,1,1)]}getViewportCount(){return this._viewportCount}getFrustum(){return this._frustum}updateMatrices(t){const e=this.camera,n=this.matrix;pu.setFromMatrixPosition(t.matrixWorld),e.position.copy(pu),mu.setFromMatrixPosition(t.target.matrixWorld),e.lookAt(mu),e.updateMatrixWorld(),Ka.multiplyMatrices(e.projectionMatrix,e.matrixWorldInverse),this._frustum.setFromProjectionMatrix(Ka),n.set(.5,0,0,.5,0,.5,0,.5,0,0,.5,.5,0,0,0,1),n.multiply(Ka)}getViewport(t){return this._viewports[t]}getFrameExtents(){return this._frameExtents}dispose(){this.map&&this.map.dispose(),this.mapPass&&this.mapPass.dispose()}copy(t){return this.camera=t.camera.clone(),this.intensity=t.intensity,this.bias=t.bias,this.radius=t.radius,this.mapSize.copy(t.mapSize),this}clone(){return new this.constructor().copy(this)}toJSON(){const t={};return this.intensity!==1&&(t.intensity=this.intensity),this.bias!==0&&(t.bias=this.bias),this.normalBias!==0&&(t.normalBias=this.normalBias),this.radius!==1&&(t.radius=this.radius),(this.mapSize.x!==512||this.mapSize.y!==512)&&(t.mapSize=this.mapSize.toArray()),t.camera=this.camera.toJSON(!1).object,delete t.camera.matrix,t}}class Nv extends Iv{constructor(){super(new wl(-5,5,5,-5,.5,500)),this.isDirectionalLightShadow=!0}}class Uv extends I0{constructor(t,e){super(t,e),this.isDirectionalLight=!0,this.type="DirectionalLight",this.position.copy(_e.DEFAULT_UP),this.updateMatrix(),this.target=new _e,this.shadow=new Nv}dispose(){this.shadow.dispose()}copy(t){return super.copy(t),this.target=t.target.clone(),this.shadow=t.shadow.clone(),this}}class zv extends ge{constructor(){super(),this.isInstancedBufferGeometry=!0,this.type="InstancedBufferGeometry",this.instanceCount=1/0}copy(t){return super.copy(t),this.instanceCount=t.instanceCount,this}toJSON(){const t=super.toJSON();return t.instanceCount=this.instanceCount,t.isInstancedBufferGeometry=!0,t}}class Fv{constructor(t=!0){this.autoStart=t,this.startTime=0,this.oldTime=0,this.elapsedTime=0,this.running=!1}start(){this.startTime=gu(),this.oldTime=this.startTime,this.elapsedTime=0,this.running=!0}stop(){this.getElapsedTime(),this.running=!1,this.autoStart=!1}getElapsedTime(){return this.getDelta(),this.elapsedTime}getDelta(){let t=0;if(this.autoStart&&!this.running)return this.start(),0;if(this.running){const e=gu();t=(e-this.oldTime)/1e3,this.oldTime=e,this.elapsedTime+=t}return t}}function gu(){return performance.now()}typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("register",{detail:{revision:ul}}));typeof window<"u"&&(window.__THREE__?console.warn("WARNING: Multiple instances of Three.js being imported."):window.__THREE__=ul);class Bv{constructor(){b(this,"cell",8);b(this,"map",new Map);b(this,"all",[])}key(t,e){return t+4096<<13^e+4096}add(t){this.all.push(t);const e=Math.floor((t.x-t.r)/this.cell),n=Math.floor((t.x+t.r)/this.cell),i=Math.floor((t.z-t.r)/this.cell),s=Math.floor((t.z+t.r)/this.cell);for(let o=e;o<=n;o++)for(let a=i;a<=s;a++){const c=this.key(o,a);let l=this.map.get(c);l||this.map.set(c,l=[]),l.push(t)}}free(t,e,n){const i=this.map.get(this.key(Math.floor(t/this.cell),Math.floor(e/this.cell)));if(!i)return!0;for(const s of i)if((s.x-t)**2+(s.z-e)**2<(s.r+n)**2)return!1;return!0}resolve(t,e){for(let n=0;n<2;n++){const i=Math.floor(t.x/this.cell),s=Math.floor(t.z/this.cell);for(let o=-1;o<=1;o++)for(let a=-1;a<=1;a++){const c=this.map.get(this.key(i+o,s+a));if(c)for(const l of c){const h=t.x-l.x,d=t.z-l.z,f=h*h+d*d,u=l.r+e;if(f<u*u&&f>1e-8){const m=Math.sqrt(f);t.x=l.x+h/m*u,t.z=l.z+d/m*u}}}}return t}}const ne={uTime:{value:0},uSunDir:{value:new A(-.8,.2,.2).normalize()},uSunColor:{value:new dt(1,.72,.45)},uWind:{value:new A(1,0,.35)},uWindStrength:{value:1},uCamPos:{value:new A},uPushers:{value:Array.from({length:6},()=>new we(0,-999,0,0))}},N0=`
float dHash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float dNoise(vec2 p){
  vec2 i = floor(p); vec2 f = fract(p);
  float a = dHash12(i), b = dHash12(i + vec2(1.0, 0.0)), c = dHash12(i + vec2(0.0, 1.0)), d = dHash12(i + vec2(1.0, 1.0));
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
// round cellular dots (for bushes / stones seen from afar): returns 1 inside a dot
float dCellDots(vec2 p, float radius){
  vec2 i = floor(p); vec2 f = fract(p); float m = 0.0;
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
    vec2 g = vec2(float(x), float(y));
    vec2 o = vec2(dHash12(i + g), dHash12(i + g + 19.19));
    float r = radius * (0.5 + dHash12(i + g + 7.7));
    float d = length(g + o - f);
    m = max(m, 1.0 - smoothstep(r * 0.7, r, d));
  }
  return m;
}
float dFbm(vec2 p){ float s = 0.0, a = 0.5; for(int i = 0; i < 4; i++){ s += a * dNoise(p); p = p * 2.03 + 17.1; a *= 0.5; } return s; }
`,Ov={name:"CopyShader",uniforms:{tDiffuse:{value:null},opacity:{value:1}},vertexShader:`

		varying vec2 vUv;

		void main() {

			vUv = uv;
			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

		}`,fragmentShader:`

		uniform float opacity;

		uniform sampler2D tDiffuse;

		varying vec2 vUv;

		void main() {

			vec4 texel = texture2D( tDiffuse, vUv );
			gl_FragColor = opacity * texel;


		}`};class Wi{constructor(){this.isPass=!0,this.enabled=!0,this.needsSwap=!0,this.clear=!1,this.renderToScreen=!1}setSize(){}render(){console.error("THREE.Pass: .render() must be implemented in derived pass.")}dispose(){}}const Hv=new wl(-1,1,1,-1,0,1);class Vv extends ge{constructor(){super(),this.setAttribute("position",new $t([-1,3,0,-1,-1,0,3,-1,0],3)),this.setAttribute("uv",new $t([0,2,0,0,2,0],2))}}const Gv=new Vv;class Ir{constructor(t){this._mesh=new Ht(Gv,t)}dispose(){this._mesh.geometry.dispose()}render(t){t.render(this._mesh,Hv)}get material(){return this._mesh.material}set material(t){this._mesh.material=t}}class Wv extends Wi{constructor(t,e){super(),this.textureID=e!==void 0?e:"tDiffuse",t instanceof Ye?(this.uniforms=t.uniforms,this.material=t):t&&(this.uniforms=m0.clone(t.uniforms),this.material=new Ye({name:t.name!==void 0?t.name:"unspecified",defines:Object.assign({},t.defines),uniforms:this.uniforms,vertexShader:t.vertexShader,fragmentShader:t.fragmentShader})),this.fsQuad=new Ir(this.material)}render(t,e,n){this.uniforms[this.textureID]&&(this.uniforms[this.textureID].value=n.texture),this.fsQuad.material=this.material,this.renderToScreen?(t.setRenderTarget(null),this.fsQuad.render(t)):(t.setRenderTarget(e),this.clear&&t.clear(t.autoClearColor,t.autoClearDepth,t.autoClearStencil),this.fsQuad.render(t))}dispose(){this.material.dispose(),this.fsQuad.dispose()}}class vu extends Wi{constructor(t,e){super(),this.scene=t,this.camera=e,this.clear=!0,this.needsSwap=!1,this.inverse=!1}render(t,e,n){const i=t.getContext(),s=t.state;s.buffers.color.setMask(!1),s.buffers.depth.setMask(!1),s.buffers.color.setLocked(!0),s.buffers.depth.setLocked(!0);let o,a;this.inverse?(o=0,a=1):(o=1,a=0),s.buffers.stencil.setTest(!0),s.buffers.stencil.setOp(i.REPLACE,i.REPLACE,i.REPLACE),s.buffers.stencil.setFunc(i.ALWAYS,o,4294967295),s.buffers.stencil.setClear(a),s.buffers.stencil.setLocked(!0),t.setRenderTarget(n),this.clear&&t.clear(),t.render(this.scene,this.camera),t.setRenderTarget(e),this.clear&&t.clear(),t.render(this.scene,this.camera),s.buffers.color.setLocked(!1),s.buffers.depth.setLocked(!1),s.buffers.color.setMask(!0),s.buffers.depth.setMask(!0),s.buffers.stencil.setLocked(!1),s.buffers.stencil.setFunc(i.EQUAL,1,4294967295),s.buffers.stencil.setOp(i.KEEP,i.KEEP,i.KEEP),s.buffers.stencil.setLocked(!0)}}class qv extends Wi{constructor(){super(),this.needsSwap=!1}render(t){t.state.buffers.stencil.setLocked(!1),t.state.buffers.stencil.setTest(!1)}}class Xv{constructor(t,e){if(this.renderer=t,this._pixelRatio=t.getPixelRatio(),e===void 0){const n=t.getSize(new ct);this._width=n.width,this._height=n.height,e=new ei(this._width*this._pixelRatio,this._height*this._pixelRatio,{type:xi}),e.texture.name="EffectComposer.rt1"}else this._width=e.width,this._height=e.height;this.renderTarget1=e,this.renderTarget2=e.clone(),this.renderTarget2.texture.name="EffectComposer.rt2",this.writeBuffer=this.renderTarget1,this.readBuffer=this.renderTarget2,this.renderToScreen=!0,this.passes=[],this.copyPass=new Wv(Ov),this.copyPass.material.blending=jn,this.clock=new Fv}swapBuffers(){const t=this.readBuffer;this.readBuffer=this.writeBuffer,this.writeBuffer=t}addPass(t){this.passes.push(t),t.setSize(this._width*this._pixelRatio,this._height*this._pixelRatio)}insertPass(t,e){this.passes.splice(e,0,t),t.setSize(this._width*this._pixelRatio,this._height*this._pixelRatio)}removePass(t){const e=this.passes.indexOf(t);e!==-1&&this.passes.splice(e,1)}isLastEnabledPass(t){for(let e=t+1;e<this.passes.length;e++)if(this.passes[e].enabled)return!1;return!0}render(t){t===void 0&&(t=this.clock.getDelta());const e=this.renderer.getRenderTarget();let n=!1;for(let i=0,s=this.passes.length;i<s;i++){const o=this.passes[i];if(o.enabled!==!1){if(o.renderToScreen=this.renderToScreen&&this.isLastEnabledPass(i),o.render(this.renderer,this.writeBuffer,this.readBuffer,t,n),o.needsSwap){if(n){const a=this.renderer.getContext(),c=this.renderer.state.buffers.stencil;c.setFunc(a.NOTEQUAL,1,4294967295),this.copyPass.render(this.renderer,this.writeBuffer,this.readBuffer,t),c.setFunc(a.EQUAL,1,4294967295)}this.swapBuffers()}vu!==void 0&&(o instanceof vu?n=!0:o instanceof qv&&(n=!1))}}this.renderer.setRenderTarget(e)}reset(t){if(t===void 0){const e=this.renderer.getSize(new ct);this._pixelRatio=this.renderer.getPixelRatio(),this._width=e.width,this._height=e.height,t=this.renderTarget1.clone(),t.setSize(this._width*this._pixelRatio,this._height*this._pixelRatio)}this.renderTarget1.dispose(),this.renderTarget2.dispose(),this.renderTarget1=t,this.renderTarget2=t.clone(),this.writeBuffer=this.renderTarget1,this.readBuffer=this.renderTarget2}setSize(t,e){this._width=t,this._height=e;const n=this._width*this._pixelRatio,i=this._height*this._pixelRatio;this.renderTarget1.setSize(n,i),this.renderTarget2.setSize(n,i);for(let s=0;s<this.passes.length;s++)this.passes[s].setSize(n,i)}setPixelRatio(t){this._pixelRatio=t,this.setSize(this._width,this._height)}dispose(){this.renderTarget1.dispose(),this.renderTarget2.dispose(),this.copyPass.dispose()}}class jv extends Wi{constructor(t,e,n=null,i=null,s=null){super(),this.scene=t,this.camera=e,this.overrideMaterial=n,this.clearColor=i,this.clearAlpha=s,this.clear=!0,this.clearDepth=!1,this.needsSwap=!1,this._oldClearColor=new dt}render(t,e,n){const i=t.autoClear;t.autoClear=!1;let s,o;this.overrideMaterial!==null&&(o=this.scene.overrideMaterial,this.scene.overrideMaterial=this.overrideMaterial),this.clearColor!==null&&(t.getClearColor(this._oldClearColor),t.setClearColor(this.clearColor,t.getClearAlpha())),this.clearAlpha!==null&&(s=t.getClearAlpha(),t.setClearAlpha(this.clearAlpha)),this.clearDepth==!0&&t.clearDepth(),t.setRenderTarget(this.renderToScreen?null:n),this.clear===!0&&t.clear(t.autoClearColor,t.autoClearDepth,t.autoClearStencil),t.render(this.scene,this.camera),this.clearColor!==null&&t.setClearColor(this._oldClearColor),this.clearAlpha!==null&&t.setClearAlpha(s),this.overrideMaterial!==null&&(this.scene.overrideMaterial=o),t.autoClear=i}}const Yv="varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }",xu=`
  uniform sampler2D tSrc; uniform vec2 uTexel; uniform float uThreshold, uKnee, uClamp, uKaris;
  varying vec2 vUv;
  vec3 T(vec2 o){ return texture2D(tSrc, vUv + o * uTexel).rgb; }
  float luma(vec3 c){ return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
  #ifdef PREFILTER
  vec3 pre(vec3 c){
    c = min(c, vec3(uClamp));
    float br = max(c.r, max(c.g, c.b));
    float rq = clamp(br - uThreshold + uKnee, 0.0, 2.0 * uKnee);
    rq = rq * rq / (4.0 * uKnee + 1e-4);
    return c * (max(rq, br - uThreshold) / max(br, 1e-4));
  }
  vec3 group(vec3 a, vec3 b, vec3 c, vec3 d){
    vec3 g = pre((a + b + c + d) * 0.25);
    return g / (1.0 + luma(g) * uKaris); // (partial) Karis average: tames single-pixel fireflies
  }
  #else
  vec3 group(vec3 a, vec3 b, vec3 c, vec3 d){ return (a + b + c + d) * 0.25; }
  #endif
  void main(){
    vec3 a = T(vec2(-2.0, 2.0)), b = T(vec2(0.0, 2.0)), c = T(vec2(2.0, 2.0));
    vec3 d = T(vec2(-2.0, 0.0)), e = T(vec2(0.0, 0.0)), f = T(vec2(2.0, 0.0));
    vec3 g = T(vec2(-2.0, -2.0)), h = T(vec2(0.0, -2.0)), i = T(vec2(2.0, -2.0));
    vec3 j = T(vec2(-1.0, 1.0)), k = T(vec2(1.0, 1.0)), l = T(vec2(-1.0, -1.0)), m = T(vec2(1.0, -1.0));
    vec3 col = group(j, k, l, m) * 0.5
      + (group(a, b, d, e) + group(b, c, e, f) + group(d, e, g, h) + group(e, f, h, i)) * 0.125;
    gl_FragColor = vec4(max(col, vec3(0.0)), 1.0);
  }`,$v=`
  uniform sampler2D tSrc; uniform vec2 uTexel; uniform float uWeight;
  varying vec2 vUv;
  vec3 T(vec2 o){ return texture2D(tSrc, vUv + o * uTexel).rgb; }
  void main(){
    vec3 s = T(vec2(0.0)) * 4.0
      + (T(vec2(-1.0, 0.0)) + T(vec2(1.0, 0.0)) + T(vec2(0.0, -1.0)) + T(vec2(0.0, 1.0))) * 2.0
      + T(vec2(-1.0, -1.0)) + T(vec2(1.0, -1.0)) + T(vec2(-1.0, 1.0)) + T(vec2(1.0, 1.0));
    gl_FragColor = vec4(s * (uWeight / 16.0), 1.0);
  }`,Kv=`
  uniform sampler2D tSrc; uniform vec2 uTexel; uniform float uStrength;
  varying vec2 vUv;
  void main(){
    // 4 bilinear taps = smooth tent up-sample of the half/quarter resolution bloom
    vec3 s = texture2D(tSrc, vUv + vec2(-0.5, -0.5) * uTexel).rgb + texture2D(tSrc, vUv + vec2(0.5, -0.5) * uTexel).rgb
      + texture2D(tSrc, vUv + vec2(-0.5, 0.5) * uTexel).rgb + texture2D(tSrc, vUv + vec2(0.5, 0.5) * uTexel).rgb;
    gl_FragColor = vec4(s * (0.25 * uStrength), 1.0);
  }`;function go(r,t,e={},n=jn){const i=new Ye({uniforms:t,defines:e,vertexShader:Yv,fragmentShader:r,depthTest:!1,depthWrite:!1,blending:n});return n===zo&&(i.blendSrc=pc,i.blendDst=pc,i.blendEquation=Li),i.toneMapped=!1,i}class Zv extends Wi{constructor(e){super();b(this,"strength");b(this,"radius");b(this,"threshold");b(this,"knee");b(this,"mips",[]);b(this,"quad",new Ir);b(this,"downPre");b(this,"down");b(this,"up");b(this,"composite");b(this,"scale");this.needsSwap=!1,this.strength=e.strength,this.radius=e.radius,this.threshold=e.threshold,this.knee=e.knee,this.scale=e.scale;const n=Math.max(3,Math.min(7,Math.round(e.mips)));for(let o=0;o<n;o++){const a=new ei(1,1,{type:e.type,format:Sn,depthBuffer:!1,stencilBuffer:!1,minFilter:bn,magFilter:bn,generateMipmaps:!1});a.texture.name="Bloom.mip"+o,this.mips.push(a)}const i=()=>({tSrc:{value:null},uTexel:{value:new ct}}),s=()=>({uThreshold:{value:1},uKnee:{value:.5},uClamp:{value:32},uKaris:{value:.02}});this.downPre=go(xu,{...i(),...s()},{PREFILTER:""}),this.down=go(xu,{...i(),...s()}),this.up=go($v,{...i(),uWeight:{value:1}},{},zo),this.composite=go(Kv,{...i(),uStrength:{value:0}},{},zo)}setSize(e,n){let i=Math.max(1,Math.round(e*this.scale)),s=Math.max(1,Math.round(n*this.scale));for(const o of this.mips)o.setSize(i,s),i=Math.max(1,Math.round(i/2)),s=Math.max(1,Math.round(s/2))}render(e,n,i){const s=e.autoClear;e.autoClear=!1;const o=this.mips.length;let a=i.texture,c=i.width,l=i.height;for(let f=0;f<o;f++){const u=f===0?this.downPre:this.down;u.uniforms.tSrc.value=a,u.uniforms.uTexel.value.set(1/c,1/l),f===0&&(u.uniforms.uThreshold.value=this.threshold,u.uniforms.uKnee.value=Math.max(.001,this.knee)),this.quad.material=u,e.setRenderTarget(this.mips[f]),this.quad.render(e),a=this.mips[f].texture,c=this.mips[f].width,l=this.mips[f].height}this.quad.material=this.up,this.up.uniforms.uWeight.value=this.radius;for(let f=o-2;f>=0;f--){const u=this.mips[f+1];this.up.uniforms.tSrc.value=u.texture,this.up.uniforms.uTexel.value.set(1/u.width,1/u.height),e.setRenderTarget(this.mips[f]),this.quad.render(e)}let h=0;for(let f=0,u=1;f<o;f++,u*=this.radius)h+=u;const d=this.mips[0];this.composite.uniforms.tSrc.value=d.texture,this.composite.uniforms.uTexel.value.set(1/d.width,1/d.height),this.composite.uniforms.uStrength.value=this.strength/h,this.quad.material=this.composite,e.setRenderTarget(this.renderToScreen?null:i),this.quad.render(e),e.autoClear=s}dispose(){for(const e of this.mips)e.dispose();this.downPre.dispose(),this.down.dispose(),this.up.dispose(),this.composite.dispose(),this.quad.dispose()}}const Jv=256,Qv=`
  bool pfxBad(float x){ return (floatBitsToUint(x) & 0x7fffffffu) > 0x7f800000u; } // NaN
  vec3 pfxSanitize(vec3 c, float hi){
    c = vec3(pfxBad(c.r) ? 0.0 : c.r, pfxBad(c.g) ? 0.0 : c.g, pfxBad(c.b) ? 0.0 : c.b);
    return clamp(c, vec3(0.0), vec3(hi)); // +Inf -> hi, -Inf/negatives -> 0
  }`,Dl="varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }";class tx extends Wi{constructor(e,n,i){super();b(this,"uniforms");b(this,"quad");b(this,"material");this.camera=e,this.uniforms={tDiffuse:{value:null},tDepth:{value:null},tSky:{value:n},uProjInv:{value:new Dt},uCamWorld:{value:new Dt},uCamPos:{value:new A},uSunDir:ne.uSunDir,uSunColor:ne.uSunColor,uDensity:{value:42e-5},uHeightFalloff:{value:.0065},uBaseHeight:{value:-20},uSunUV:{value:new ct},uSunOnScreen:{value:0},uGodRays:{value:.24},uGodRaySamples:{value:i},uHazeTint:{value:new dt(1,1,1)}},this.material=new Ye({uniforms:this.uniforms,defines:{GR_MAX:Math.max(4,i),HDR_MAX:Jv.toFixed(1)},depthTest:!1,depthWrite:!1,vertexShader:Dl,fragmentShader:`
        uniform sampler2D tDiffuse; uniform sampler2D tDepth; uniform samplerCube tSky;
        uniform mat4 uProjInv; uniform mat4 uCamWorld; uniform vec3 uCamPos;
        uniform vec3 uSunDir; uniform vec3 uSunColor; uniform vec3 uHazeTint;
        uniform float uDensity, uHeightFalloff, uBaseHeight, uSunOnScreen, uGodRays;
        uniform int uGodRaySamples;
        uniform vec2 uSunUV;
        varying vec2 vUv;
        ${Qv}
        vec3 worldFromDepth(vec2 uv, float d){
          vec4 clip = vec4(uv * 2.0 - 1.0, d * 2.0 - 1.0, 1.0);
          vec4 v = uProjInv * clip; v /= v.w;
          return (uCamWorld * v).xyz;
        }
        void main(){
          vec3 col = pfxSanitize(texture2D(tDiffuse, vUv).rgb, HDR_MAX);
          float depth = texture2D(tDepth, vUv).x;
          vec3 wp = worldFromDepth(vUv, depth);
          vec3 rd = normalize(wp - uCamPos);
          float mu = max(dot(rd, uSunDir), 0.0);
          if (depth < 0.99999) {
            float dist = length(wp - uCamPos);
            // exponential height fog (analytic integral along the ray)
            float b = uHeightFalloff;
            float h0 = max(uCamPos.y - uBaseHeight, 0.0);
            float ry = rd.y;
            float fogAmt;
            if (abs(ry) > 1e-4) fogAmt = uDensity * exp(-h0 * b) * (1.0 - exp(clamp(-dist * ry * b, -80.0, 80.0))) / (ry * b);
            else fogAmt = uDensity * exp(-h0 * b) * dist;
            fogAmt = 1.0 - exp(-max(fogAmt, 0.0));
            fogAmt = clamp(fogAmt, 0.0, 0.985);
            vec3 skyDir = normalize(vec3(rd.x, max(rd.y, 0.015) * 0.35 + 0.012, rd.z));
            vec3 haze = textureCube(tSky, skyDir).rgb * uHazeTint;
            // golden-hour aerial perspective: warm toward the sun, dusty violet-blue away from it
            float sunSide = pow(mu, 3.0);
            haze *= mix(vec3(0.62, 0.62, 0.74), vec3(1.0, 0.82, 0.6), sunSide);
            vec3 inscatter = uSunColor * (pow(mu, 8.0) * 0.6 + pow(mu, 48.0) * 0.9);
            col = mix(col, haze + inscatter * fogAmt, fogAmt);
          }
          // god rays: march toward the sun in screen space, count sky pixels
          if (uSunOnScreen > 0.001) {
            float n = float(uGodRaySamples);
            vec2 delta = (uSunUV - vUv) / n;
            vec2 uv = vUv;
            float illum = 0.0, decay = 1.0, wsum = 0.0;
            float jitter = fract(sin(dot(vUv, vec2(12.9898, 78.233))) * 43758.5453);
            uv += delta * jitter;
            for (int i = 0; i < GR_MAX; i++) {
              if (i >= uGodRaySamples) break;
              uv += delta;
              float dd = texture2D(tDepth, clamp(uv, 0.001, 0.999)).x;
              illum += step(0.99999, dd) * decay;
              wsum += decay;
              decay *= 0.965;
            }
            illum /= max(wsum, 1e-3);
            float radial = 1.0 - smoothstep(0.0, 0.65, length((vUv - uSunUV) * vec2(1.7, 1.0)));
            col += uSunColor * illum * radial * uGodRays * uSunOnScreen * 0.55;
          }
          gl_FragColor = vec4(pfxSanitize(col, HDR_MAX), 1.0);
        }`}),this.material.toneMapped=!1,this.quad=new Ir(this.material)}setGodRaySamples(e){this.uniforms.uGodRaySamples.value=Math.max(0,Math.min(e,Number(this.material.defines.GR_MAX)))}render(e,n,i){const s=this.camera;this.uniforms.tDiffuse.value=i.texture,this.uniforms.tDepth.value=i.depthTexture,this.uniforms.uProjInv.value.copy(s.projectionMatrixInverse),this.uniforms.uCamWorld.value.copy(s.matrixWorld),this.uniforms.uCamPos.value.setFromMatrixPosition(s.matrixWorld);const o=ne.uSunDir.value.clone().multiplyScalar(5e3).add(this.uniforms.uCamPos.value);o.project(s);const c=new A(0,0,-1).applyQuaternion(s.quaternion).dot(ne.uSunDir.value),l=Number.isFinite(o.x)&&Number.isFinite(o.y);this.uniforms.uSunUV.value.set(l?o.x*.5+.5:.5,l?o.y*.5+.5:.5);const h=c>0&&l&&this.uniforms.uGodRaySamples.value>0?Bt.smoothstep(c,0,.5)*(1-Bt.smoothstep(Math.max(Math.abs(o.x),Math.abs(o.y)),1,1.9)):0;this.uniforms.uSunOnScreen.value=h,e.setRenderTarget(this.renderToScreen?null:n),this.quad.render(e)}dispose(){this.material.dispose(),this.quad.dispose()}}function U0(){return{uTime:{value:0},uVignette:{value:.16},uGrain:{value:.018},uSaturation:{value:1.06},uContrast:{value:1.05},uFade:{value:0},uDesat:{value:0},uRed:{value:0},uCA:{value:.0012},uWarm:{value:.03}}}class ex extends Wi{constructor(e,n){super();b(this,"uniforms");b(this,"material");b(this,"quad");b(this,"toneMapping",-1);this.uniforms=e;const i={};n&&(i.USE_CA=""),this.material=new Ye({uniforms:{...e,tDiffuse:{value:null},toneMappingExposure:{value:1},uAspect:{value:1}},defines:i,depthTest:!1,depthWrite:!1,vertexShader:Dl,fragmentShader:`
        uniform sampler2D tDiffuse; uniform float uTime, uVignette, uSaturation, uContrast, uFade, uDesat, uRed, uCA, uWarm, uAspect;
        varying vec2 vUv;
        #include <tonemapping_pars_fragment>
        vec3 toneMap(vec3 c){
          #if defined(TM_AGX)
            return AgXToneMapping(c);
          #elif defined(TM_NEUTRAL)
            return NeutralToneMapping(c);
          #elif defined(TM_REINHARD)
            return ReinhardToneMapping(c);
          #elif defined(TM_LINEAR)
            return LinearToneMapping(c);
          #else
            return ACESFilmicToneMapping(c);
          #endif
        }
        void main(){
          vec2 dir = vUv - 0.5;
          vec3 hdr;
          #ifdef USE_CA
            float r2 = dot(dir, dir);
            hdr.r = texture2D(tDiffuse, vUv - dir * uCA * r2 * 4.0).r;
            hdr.g = texture2D(tDiffuse, vUv).g;
            hdr.b = texture2D(tDiffuse, vUv + dir * uCA * r2 * 4.0).b;
          #else
            hdr = texture2D(tDiffuse, vUv).rgb;
          #endif
          vec3 col = sRGBTransferOETF(vec4(toneMap(max(hdr, vec3(0.0))), 1.0)).rgb;
          // grade: gentle S-curve, warm highlights / teal-ish shadows (film look)
          float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
          col = mix(vec3(l), col, uSaturation * (1.0 - uDesat));
          col = (col - 0.5) * uContrast + 0.5;
          col += vec3(uWarm, uWarm * 0.35, -uWarm * 0.6) * smoothstep(0.35, 1.0, l);
          col += vec3(-0.012, 0.0, 0.018) * (1.0 - smoothstep(0.0, 0.35, l));
          // vignette, relative to the long screen axis (in portrait the old UV-space ellipse turned into
          // dark bars down both sides of a phone screen)
          vec2 vd = uAspect >= 1.0 ? dir : dir.yx;
          float v = smoothstep(0.85, 0.2, length(vd * vec2(1.0, 0.85)) * (1.0 + uVignette));
          col *= mix(1.0, v, 0.9);
          // damage pulse
          col = mix(col, col * vec3(1.25, 0.45, 0.4), uRed * smoothstep(0.1, 0.6, length(dir)));
          col *= 1.0 - uFade;
          gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
        }`}),this.material.toneMapped=!1,this.quad=new Ir(this.material)}render(e,n,i){if(e.toneMapping!==this.toneMapping){this.toneMapping=e.toneMapping;const o=this.material.defines;delete o.TM_AGX,delete o.TM_NEUTRAL,delete o.TM_REINHARD,delete o.TM_LINEAR,this.toneMapping===$u?o.TM_AGX="":this.toneMapping===Ku?o.TM_NEUTRAL="":this.toneMapping===ju?o.TM_REINHARD="":(this.toneMapping===Xu||this.toneMapping===Yn)&&(o.TM_LINEAR=""),this.material.needsUpdate=!0}const s=this.material.uniforms;s.tDiffuse.value=i.texture,s.uAspect.value=i.width/Math.max(1,i.height),s.toneMappingExposure.value=e.toneMapping===Yn?1:e.toneMappingExposure,e.setRenderTarget(this.renderToScreen?null:n),this.quad.render(e)}dispose(){this.material.dispose(),this.quad.dispose()}}class nx extends Wi{constructor(e,n){super();b(this,"uniforms");b(this,"material");b(this,"quad");this.uniforms={tDiffuse:{value:null},uRcp:{value:new ct(1/1024,1/1024)},uSharp:{value:e.sharpen},uGrain:n.uGrain,uTime:n.uTime};const i={};e.fxaa&&(i.USE_FXAA=""),e.grain&&(i.USE_GRAIN=""),this.material=new Ye({uniforms:this.uniforms,defines:i,depthTest:!1,depthWrite:!1,vertexShader:Dl,fragmentShader:`
        uniform sampler2D tDiffuse; uniform vec2 uRcp; uniform float uSharp, uGrain, uTime;
        varying vec2 vUv;
        float luma(vec3 c){ return dot(c, vec3(0.299, 0.587, 0.114)); }
        vec3 T(vec2 p){ return texture2D(tDiffuse, p).rgb; }
        vec3 cas(vec3 m, vec3 n, vec3 s, vec3 e, vec3 w){
          if (uSharp <= 0.0) return m;
          vec3 mn = min(m, min(min(n, s), min(e, w)));
          vec3 mx = max(m, max(max(n, s), max(e, w)));
          vec3 amp = sqrt(clamp(min(mn, 1.0 - mx) / max(mx, vec3(1e-4)), 0.0, 1.0));
          vec3 wgt = amp * (-1.0 / mix(8.0, 4.5, uSharp));
          return clamp((m + (n + s + e + w) * wgt) / (1.0 + 4.0 * wgt), 0.0, 1.0);
        }
        float hash(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
        void main(){
          vec2 posM = vUv;
          vec3 rgbM = T(posM);
          vec3 rgbN = T(posM + vec2(0.0, -uRcp.y));
          vec3 rgbS = T(posM + vec2(0.0, uRcp.y));
          vec3 rgbE = T(posM + vec2(uRcp.x, 0.0));
          vec3 rgbW = T(posM + vec2(-uRcp.x, 0.0));
          vec3 col = rgbM;
        #ifdef USE_FXAA
          float lumaM = luma(rgbM), lumaN = luma(rgbN), lumaS = luma(rgbS), lumaE = luma(rgbE), lumaW = luma(rgbW);
          float rangeMax = max(max(lumaN, lumaW), max(lumaE, max(lumaS, lumaM)));
          float rangeMin = min(min(lumaN, lumaW), min(lumaE, min(lumaS, lumaM)));
          float range = rangeMax - rangeMin;
          if (range < max(0.0625, rangeMax * 0.125)) {
            col = cas(rgbM, rgbN, rgbS, rgbE, rgbW);
          } else {
            float lumaNW = luma(T(posM + vec2(-uRcp.x, -uRcp.y)));
            float lumaSE = luma(T(posM + vec2(uRcp.x, uRcp.y)));
            float lumaNE = luma(T(posM + vec2(uRcp.x, -uRcp.y)));
            float lumaSW = luma(T(posM + vec2(-uRcp.x, uRcp.y)));
            float lumaNS = lumaN + lumaS, lumaWE = lumaW + lumaE;
            float subpixRcpRange = 1.0 / range;
            float subpixNSWE = lumaNS + lumaWE;
            float edgeHorz1 = -2.0 * lumaM + lumaNS;
            float edgeVert1 = -2.0 * lumaM + lumaWE;
            float lumaNESE = lumaNE + lumaSE, lumaNWNE = lumaNW + lumaNE;
            float edgeHorz2 = -2.0 * lumaE + lumaNESE;
            float edgeVert2 = -2.0 * lumaN + lumaNWNE;
            float lumaNWSW = lumaNW + lumaSW, lumaSWSE = lumaSW + lumaSE;
            float edgeHorz4 = abs(edgeHorz1) * 2.0 + abs(edgeHorz2);
            float edgeVert4 = abs(edgeVert1) * 2.0 + abs(edgeVert2);
            float edgeHorz3 = -2.0 * lumaW + lumaNWSW;
            float edgeVert3 = -2.0 * lumaS + lumaSWSE;
            float edgeHorz = abs(edgeHorz3) + edgeHorz4;
            float edgeVert = abs(edgeVert3) + edgeVert4;
            float subpixNWSWNESE = lumaNWSW + lumaNESE;
            float lengthSign = uRcp.x;
            bool horzSpan = edgeHorz >= edgeVert;
            float subpixA = subpixNSWE * 2.0 + subpixNWSWNESE;
            if (!horzSpan) { lumaN = lumaW; lumaS = lumaE; } else lengthSign = uRcp.y;
            float subpixB = subpixA * (1.0 / 12.0) - lumaM;
            float gradientN = lumaN - lumaM, gradientS = lumaS - lumaM;
            float lumaNN = lumaN + lumaM, lumaSS = lumaS + lumaM;
            bool pairN = abs(gradientN) >= abs(gradientS);
            float gradient = max(abs(gradientN), abs(gradientS));
            if (pairN) lengthSign = -lengthSign;
            float subpixC = clamp(abs(subpixB) * subpixRcpRange, 0.0, 1.0);
            vec2 posB = posM;
            vec2 offNP = horzSpan ? vec2(uRcp.x, 0.0) : vec2(0.0, uRcp.y);
            if (!horzSpan) posB.x += lengthSign * 0.5; else posB.y += lengthSign * 0.5;
            vec2 posN = posB - offNP, posP = posB + offNP;
            float subpixD = -2.0 * subpixC + 3.0;
            float subpixE = subpixC * subpixC;
            if (!pairN) lumaNN = lumaSS;
            float gradientScaled = gradient * 0.25;
            float lumaMM = lumaM - lumaNN * 0.5;
            float subpixF = subpixD * subpixE;
            bool lumaMLTZero = lumaMM < 0.0;
            float lumaEndN = luma(T(posN)) - lumaNN * 0.5;
            float lumaEndP = luma(T(posP)) - lumaNN * 0.5;
            bool doneN = abs(lumaEndN) >= gradientScaled;
            bool doneP = abs(lumaEndP) >= gradientScaled;
            if (!doneN) posN -= offNP * 1.5;
            if (!doneP) posP += offNP * 1.5;
            const float STEPS[6] = float[6](2.0, 2.0, 2.0, 4.0, 8.0, 12.0);
            for (int i = 0; i < 6; i++) {
              if (doneN && doneP) break;
              if (!doneN) lumaEndN = luma(T(posN)) - lumaNN * 0.5;
              if (!doneP) lumaEndP = luma(T(posP)) - lumaNN * 0.5;
              doneN = abs(lumaEndN) >= gradientScaled;
              doneP = abs(lumaEndP) >= gradientScaled;
              if (!doneN) posN -= offNP * STEPS[i];
              if (!doneP) posP += offNP * STEPS[i];
            }
            float dstN = horzSpan ? posM.x - posN.x : posM.y - posN.y;
            float dstP = horzSpan ? posP.x - posM.x : posP.y - posM.y;
            bool goodSpanN = (lumaEndN < 0.0) != lumaMLTZero;
            bool goodSpanP = (lumaEndP < 0.0) != lumaMLTZero;
            float spanLength = dstP + dstN;
            bool directionN = dstN < dstP;
            float dst = min(dstN, dstP);
            bool goodSpan = directionN ? goodSpanN : goodSpanP;
            float subpixG = subpixF * subpixF;
            float pixelOffset = dst * (-1.0 / spanLength) + 0.5;
            float subpixH = subpixG * 0.45; // sub-pixel AA amount (NVIDIA default 0.75; lower = sharper)
            float pixelOffsetSubpix = max(goodSpan ? pixelOffset : 0.0, subpixH);
            vec2 posF = posM;
            if (!horzSpan) posF.x += pixelOffsetSubpix * lengthSign; else posF.y += pixelOffsetSubpix * lengthSign;
            col = T(posF);
          }
        #else
          col = cas(rgbM, rgbN, rgbS, rgbE, rgbW);
        #endif
        #ifdef USE_GRAIN
          col += (hash(gl_FragCoord.xy + fract(uTime) * 517.0) - 0.5) * uGrain;
        #endif
          // triangular dither, 1 LSB of the 8-bit output: removes banding in the sky gradients
          col += (hash(gl_FragCoord.xy * 1.37 + 11.0) + hash(gl_FragCoord.xy * 0.71 + 3.0) - 1.0) / 255.0;
          gl_FragColor = vec4(col, 1.0);
        }`}),this.material.toneMapped=!1,this.quad=new Ir(this.material)}setSize(e,n){this.uniforms.uRcp.value.set(1/Math.max(1,e),1/Math.max(1,n))}render(e,n,i){this.uniforms.tDiffuse.value=i.texture,e.setRenderTarget(this.renderToScreen?null:n),this.quad.render(e)}dispose(){this.material.dispose(),this.quad.dispose()}}class ix{constructor(t,e,n,i,s){b(this,"composer");b(this,"atmosphere");b(this,"bloom");b(this,"grade");b(this,"resolve");b(this,"renderTarget");b(this,"width",1);b(this,"height",1);const o=t.getDrawingBufferSize(new ct),a=s.colorType??xi;this.renderTarget=new ei(o.x,o.y,{type:a,samples:s.msaa,depthTexture:new Go(o.x,o.y,fn)}),this.renderTarget.texture.name="PostFX.rt1",this.renderTarget.depthTexture.format=zi,this.composer=new Xv(t,this.renderTarget);const c=new Go(o.x,o.y,fn);c.format=zi,this.composer.renderTarget2.depthTexture=c,this.composer.renderTarget2.texture.name="PostFX.rt2",this.composer.setPixelRatio(1),this.composer.addPass(new jv(e,n)),this.atmosphere=new tx(n,i,s.godRaySamples),this.composer.addPass(this.atmosphere),s.bloom?(this.bloom=new Zv({strength:.6,radius:.85,threshold:.8,knee:.5,mips:s.bloomMips??5,scale:s.bloomScale??.5,type:a}),this.composer.addPass(this.bloom)):this.bloom=null;const l=s.gradeUniforms??U0(),h=s.filmFx??!0;this.grade=new ex(l,h),this.composer.addPass(this.grade),this.resolve=new nx({fxaa:s.msaa===0&&(s.aa??"fxaa")==="fxaa",sharpen:s.sharpen??0,grain:h},l),this.composer.addPass(this.resolve),this.setSize(o.x,o.y)}setSize(t,e){t=Math.max(1,Math.floor(t)),e=Math.max(1,Math.floor(e)),!(t===this.width&&e===this.height)&&(this.width=t,this.height=e,this.composer.setSize(t,e),this.resolve.setSize(t,e))}setGodRaySamples(t){this.atmosphere.setGodRaySamples(t)}setBloomEnabled(t){this.bloom&&(this.bloom.enabled=t)}render(t){this.grade.uniforms.uTime.value+=t,this.composer.render(t)}dispose(){for(const t of this.composer.passes)t.dispose?.();this.composer.renderTarget1.depthTexture?.dispose(),this.composer.renderTarget2.depthTexture?.dispose(),this.composer.dispose()}}class sx{constructor(t=1600,e=ss){b(this,"points");b(this,"parts",[]);b(this,"geo",new ge);b(this,"pos");b(this,"col");b(this,"size");this.max=t,this.pos=new Float32Array(t*3),this.col=new Float32Array(t*4),this.size=new Float32Array(t),this.geo.setAttribute("position",new te(this.pos,3).setUsage(ks)),this.geo.setAttribute("aColor",new te(this.col,4).setUsage(ks)),this.geo.setAttribute("aSize",new te(this.size,1).setUsage(ks));const n=new Ye({uniforms:{uSunDir:ne.uSunDir,uSunColor:ne.uSunColor,uScale:{value:600}},transparent:!0,depthWrite:!1,blending:e,vertexShader:`
        attribute vec4 aColor; attribute float aSize; uniform float uScale;
        varying vec4 vColor; varying vec3 vWPos;
        void main(){
          vColor = aColor; vWPos = position;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = aSize * uScale / max(-mv.z, 0.1);
          gl_Position = projectionMatrix * mv;
        }`,fragmentShader:`
        uniform vec3 uSunDir; uniform vec3 uSunColor;
        varying vec4 vColor; varying vec3 vWPos;
        void main(){
          vec2 c = gl_PointCoord * 2.0 - 1.0;
          float r = dot(c, c);
          if (r > 1.0) discard;
          float soft = pow(1.0 - r, 1.6);
          vec3 vd = normalize(vWPos - cameraPosition);
          float back = pow(max(dot(vd, uSunDir), 0.0), 4.0);
          vec3 col = vColor.rgb * (0.55 + 0.6 * uSunColor) + uSunColor * back * 0.5 * vColor.rgb;
          gl_FragColor = vec4(col, vColor.a * soft);
        }`});this.points=new P0(this.geo,n),this.points.frustumCulled=!1,this.points.renderOrder=5}setPixelScale(t,e){this.points.material.uniforms.uScale.value=t/(2*Math.tan(Bt.degToRad(e)/2))}emit(t){this.parts.length>=this.max&&this.parts.shift(),this.parts.push({vx:0,vy:0,vz:0,life:0,max:2,size:.5,grow:.3,r:.7,g:.62,b:.5,a:.5,drag:1,grav:0,...t})}dustBurst(t,e,n=1,i=new dt(.72,.62,.48)){for(let s=0;s<e;s++){const o=Math.random()*Math.PI*2,a=(.4+Math.random())*n;this.emit({x:t.x+(Math.random()-.5)*.3,y:t.y+Math.random()*.2,z:t.z+(Math.random()-.5)*.3,vx:Math.cos(o)*a,vy:Math.random()*.9*n+.2,vz:Math.sin(o)*a,max:1.2+Math.random()*1.4,size:.25+Math.random()*.35,grow:.55*n,r:i.r,g:i.g,b:i.b,a:.38,drag:2.2,grav:-.15})}}update(t){const e=ne.uWind.value,n=ne.uWindStrength.value;let i=0;const s=[];for(const o of this.parts){if(o.life+=t,o.life>=o.max)continue;const a=Math.exp(-o.drag*t);o.vx=o.vx*a+e.x*.35*n*t,o.vz=o.vz*a+e.z*.35*n*t,o.vy=o.vy*a-o.grav*t,o.x+=o.vx*t,o.y+=o.vy*t,o.z+=o.vz*t,o.size+=o.grow*t,s.push(o);const c=o.life/o.max,l=Math.min(1,c*6)*(1-c)*(1-c);this.pos[i*3]=o.x,this.pos[i*3+1]=o.y,this.pos[i*3+2]=o.z,this.col[i*4]=o.r,this.col[i*4+1]=o.g,this.col[i*4+2]=o.b,this.col[i*4+3]=o.a*l,this.size[i]=o.size,i++}this.parts=s,this.geo.setDrawRange(0,i),this.geo.getAttribute("position").needsUpdate=!0,this.geo.getAttribute("aColor").needsUpdate=!0,this.geo.getAttribute("aSize").needsUpdate=!0}}class rx{constructor(t=700,e=16){b(this,"points");b(this,"offsets");this.radius=e;const n=new ge;this.offsets=new Float32Array(t*3);const i=new Float32Array(t);for(let o=0;o<t;o++)this.offsets[o*3]=(Math.random()*2-1)*e,this.offsets[o*3+1]=Math.random()*6-1,this.offsets[o*3+2]=(Math.random()*2-1)*e,i[o]=Math.random();n.setAttribute("position",new te(this.offsets,3)),n.setAttribute("aSeed",new te(i,1));const s=new Ye({uniforms:{uTime:ne.uTime,uCam:ne.uCamPos,uR:{value:e},uSunDir:ne.uSunDir,uSunColor:ne.uSunColor,uScale:{value:600}},transparent:!0,depthWrite:!1,blending:Uo,vertexShader:`
        attribute float aSeed; uniform float uTime; uniform vec3 uCam; uniform float uR; uniform float uScale; uniform vec3 uSunDir;
        varying float vA;
        void main(){
          vec3 p = position;
          p.x += sin(uTime * (0.2 + aSeed * 0.3) + aSeed * 40.0) * 1.5 + uTime * 0.25;
          p.y += sin(uTime * (0.3 + aSeed * 0.2) + aSeed * 17.0) * 0.6;
          p.z += cos(uTime * (0.25 + aSeed * 0.25) + aSeed * 23.0) * 1.5 + uTime * 0.08;
          vec3 w = uCam + mod(p - uCam + uR, 2.0 * uR) - uR;
          w.y = uCam.y + p.y - 1.5;
          vec4 mv = modelViewMatrix * vec4(w, 1.0);
          vec3 vd = normalize(w - uCam);
          float back = pow(max(dot(vd, uSunDir), 0.0), 3.0);
          float dist = length(w - uCam);
          vA = (0.15 + back * 1.4) * smoothstep(uR, uR * 0.5, dist) * smoothstep(0.5, 2.0, dist) * (0.5 + 0.5 * sin(uTime * 3.0 + aSeed * 90.0));
          gl_PointSize = (0.022 + aSeed * 0.02) * uScale / max(-mv.z, 0.1);
          gl_Position = projectionMatrix * mv;
        }`,fragmentShader:`
        uniform vec3 uSunColor; varying float vA;
        void main(){
          vec2 c = gl_PointCoord * 2.0 - 1.0;
          float r = dot(c, c);
          if (r > 1.0) discard;
          gl_FragColor = vec4(uSunColor * 1.6, vA * (1.0 - r));
        }`});this.points=new P0(n,s),this.points.frustumCulled=!1,this.points.renderOrder=6}setPixelScale(t,e){this.points.material.uniforms.uScale.value=t/(2*Math.tan(Bt.degToRad(e)/2))}}class ox{constructor(t,e){b(this,"timer",0);this.ps=t,this.sources=e}update(t){for(this.timer+=t;this.timer>.12;){this.timer-=.12;for(const e of this.sources)this.ps.emit({x:e.x+(Math.random()-.5)*.6,y:e.y,z:e.z+(Math.random()-.5)*.6,vx:0,vy:1.1+Math.random()*.5,vz:0,max:9+Math.random()*4,size:1.2,grow:1.1,r:.62,g:.6,b:.6,a:.18,drag:.15,grav:0})}}}class ax{constructor(t,e){b(this,"group",new Ie);b(this,"sky");b(this,"skyUniforms");b(this,"clouds");b(this,"sun");b(this,"hemi");b(this,"skyScene",new T0);b(this,"cubeTarget");b(this,"cubeCam");b(this,"pmrem");b(this,"envRT",null);b(this,"elevation",9);b(this,"azimuth",-78);b(this,"cloudUniforms");this.renderer=t,this.skyUniforms={uSunDir:ne.uSunDir,uSunColor:ne.uSunColor,uZenith:{value:new dt(.1,.2,.42)},uHorizonWarm:{value:new dt(1.35,.78,.38)},uHorizonCool:{value:new dt(.62,.52,.62)},uGlow:{value:1}};const n=new Ye({uniforms:this.skyUniforms,side:sn,depthWrite:!1,vertexShader:`
        varying vec3 vDir;
        void main(){ vDir = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; }`,fragmentShader:`
        uniform vec3 uSunDir; uniform vec3 uSunColor; uniform vec3 uZenith; uniform vec3 uHorizonWarm; uniform vec3 uHorizonCool; uniform float uGlow;
        varying vec3 vDir;
        void main(){
          vec3 d = normalize(vDir);
          float h = d.y;
          float mu = dot(d, uSunDir);
          float az = dot(normalize(d.xz + 1e-5), normalize(uSunDir.xz + 1e-5)) * 0.5 + 0.5; // 1 toward the sun
          vec3 horizon = mix(uHorizonCool, uHorizonWarm, pow(az, 2.2));
          float t = pow(clamp(h, 0.0, 1.0), 0.42);
          vec3 col = mix(horizon, uZenith, t);
          // warm band just above the horizon on the sun side
          col += uHorizonWarm * 0.35 * pow(az, 6.0) * exp(-max(h, 0.0) * 9.0);
          // mie glow around the sun
          float m = max(mu, 0.0);
          col += uSunColor * (pow(m, 6.0) * 0.38 + pow(m, 40.0) * 1.0 + pow(m, 400.0) * 3.5) * uGlow;
          // sun disk
          float disk = smoothstep(0.99975, 0.99992, mu);
          col += uSunColor * disk * 24.0;
          // below the horizon: dusky haze
          if (h < 0.0) col = mix(horizon * 0.78, horizon * 0.45, clamp(-h * 3.0, 0.0, 1.0));
          gl_FragColor = vec4(col, 1.0);
        }`});this.sky=new Ht(new Xe(1e4,48,24),n),this.sky.renderOrder=-10,this.cloudUniforms={uSunDir:ne.uSunDir,uSunColor:ne.uSunColor,uTime:ne.uTime,uCoverage:{value:.44},uBright:{value:1}};const i=new Ye({uniforms:this.cloudUniforms,transparent:!0,depthWrite:!1,depthTest:!0,side:sn,vertexShader:`
        varying vec3 vDir;
        void main(){
          vDir = normalize(position);
          vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          gl_Position = p.xyww;
        }`,fragmentShader:`
        uniform vec3 uSunDir; uniform vec3 uSunColor; uniform float uTime; uniform float uCoverage; uniform float uBright;
        varying vec3 vDir;
        float h12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
        float vn(vec2 p){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.0-2.0*f);
          return mix(mix(h12(i),h12(i+vec2(1,0)),u.x), mix(h12(i+vec2(0,1)),h12(i+vec2(1,1)),u.x), u.y); }
        float fbm(vec2 p){ float s=0.0,a=0.5; mat2 m=mat2(1.6,1.2,-1.2,1.6); for(int i=0;i<6;i++){ s+=a*vn(p); p=m*p; a*=0.5; } return s; }
        float dens(vec2 p){
          vec2 q = vec2(fbm(p*0.6 + vec2(uTime*0.004, 0.0)), fbm(p*0.6 + vec2(3.1, 1.7)));
          float n = fbm(p + q*1.4 + vec2(uTime*0.006, uTime*0.002));
          // elongated streaks (altocumulus / stratus bands typical of evening)
          float streak = fbm(vec2(p.x*0.35, p.y*1.6) + 7.0);
          n = mix(n, streak, 0.35);
          return smoothstep(uCoverage, uCoverage + 0.28, n);
        }
        void main(){
          vec3 d = normalize(vDir);
          if (d.y <= 0.0) discard;
          vec2 p = d.xz / (d.y + 0.07) * 1.9;
          float den = dens(p);
          if (den < 0.003) discard;
          vec2 toSun = normalize(uSunDir.xz + 1e-4);
          float occl = dens(p + toSun * 0.22) * 0.6 + dens(p + toSun * 0.5) * 0.4;
          float light = exp(-occl * 2.2);
          float mu = max(dot(d, uSunDir), 0.0);
          float fwd = pow(mu, 6.0) * 1.6 + pow(mu, 40.0) * 5.0;
          vec3 shadowCol = vec3(0.34, 0.27, 0.34);
          vec3 litCol = uSunColor * vec3(1.6, 1.15, 0.8);
          float edge = 1.0 - smoothstep(0.0, 0.9, den);
          vec3 col = mix(shadowCol, litCol * 1.25, light);
          col += uSunColor * fwd * (0.4 + edge * 1.6); // silver lining near the sun
          col *= uBright;
          float horizon = smoothstep(0.0, 0.16, d.y);
          gl_FragColor = vec4(col, den * horizon * 0.94);
        }`});this.clouds=new Ht(new Xe(9e3,48,24),i),this.clouds.renderOrder=-9,this.clouds.frustumCulled=!1,this.sky.frustumCulled=!1,this.group.add(this.sky,this.clouds),this.sun=new Uv(16765600,3.4),this.sun.castShadow=!0,this.sun.shadow.mapSize.set(e,e);const s=this.sun.shadow.camera;s.left=-55,s.right=55,s.top=55,s.bottom=-55,s.near=1,s.far=600,this.sun.shadow.bias=-25e-5,this.sun.shadow.normalBias=.035,this.sun.shadow.radius=2.5,this.hemi=new Dv(10467544,7031342,.55),this.group.add(this.sun,this.sun.target,this.hemi);const o=new Ht(this.sky.geometry,n),a=new Ht(this.clouds.geometry,i);this.skyScene.add(o,a),this.cubeTarget=new _0(64,{type:xi,generateMipmaps:!0,minFilter:Di}),this.cubeCam=new v0(1,3e4,this.cubeTarget),this.skyScene.add(this.cubeCam),this.pmrem=new tl(t)}setSun(t,e,n){this.elevation=t,this.azimuth=e;const i=Bt.degToRad(90-t),s=Bt.degToRad(e),o=new A().setFromSphericalCoords(1,i,s);ne.uSunDir.value.copy(o);const a=1-Bt.smoothstep(t,0,18);this.skyUniforms.uHorizonWarm.value.setRGB(1.25+.2*a,.72+.12*(1-a),.36+.2*(1-a)),this.skyUniforms.uZenith.value.setRGB(.09+.03*(1-a),.18+.08*(1-a),.4+.12*(1-a)),this.skyUniforms.uHorizonCool.value.setRGB(.6,.5-.06*a,.6);const c=Bt.clamp(t/25,0,1),l=new dt().setRGB(1,.55+.33*c,.28+.45*c);ne.uSunColor.value.copy(l),this.sun.color.copy(l),this.sun.intensity=1.5+6*Bt.smoothstep(t,-1,10),this.hemi.intensity=.3+.3*Bt.smoothstep(t,-4,20),this.cloudUniforms.uBright.value=.55+.6*Bt.smoothstep(t,-3,10),this.capture(n)}capture(t){this.cubeCam.position.set(0,0,0),this.cubeCam.update(this.renderer,this.skyScene),this.envRT?.dispose(),this.envRT=this.pmrem.fromScene(this.skyScene,.04),t.environment=this.envRT.texture,t.environmentIntensity=.8}update(t,e){this.clouds.position.copy(t.position),this.sky.position.copy(t.position);const n=ne.uSunDir.value,i=this.sun.shadow.camera,s=(i.right-i.left)/this.sun.shadow.mapSize.x,o=e.clone(),a=new Dt().lookAt(new A,n.clone().negate(),new A(0,1,0)),c=a.clone().invert();o.applyMatrix4(c),o.x=Math.round(o.x/s)*s,o.y=Math.round(o.y/s)*s,o.applyMatrix4(a),this.sun.target.position.copy(o),this.sun.position.copy(o).addScaledVector(n,300),this.sun.target.updateMatrixWorld()}}function Gn(r){let t=r>>>0;return()=>{t=t+1831565813>>>0;let e=t;return e=Math.imul(e^e>>>15,e|1),e^=e+Math.imul(e^e>>>7,e|61),((e^e>>>14)>>>0)/4294967296}}const cx=.5*(Math.sqrt(3)-1),ur=(3-Math.sqrt(3))/6,As=new Float32Array([1,1,-1,1,1,-1,-1,-1,1,0,-1,0,0,1,0,-1]);class Qs{constructor(t=1){b(this,"perm",new Uint8Array(512));const e=Gn(t),n=new Uint8Array(256);for(let i=0;i<256;i++)n[i]=i;for(let i=255;i>0;i--){const s=Math.floor(e()*(i+1)),o=n[i];n[i]=n[s],n[s]=o}for(let i=0;i<512;i++)this.perm[i]=n[i&255]}noise(t,e){const n=this.perm,i=(t+e)*cx,s=Math.floor(t+i),o=Math.floor(e+i),a=(s+o)*ur,c=t-(s-a),l=e-(o-a),h=c>l?1:0,d=c>l?0:1,f=c-h+ur,u=l-d+ur,m=c-1+2*ur,v=l-1+2*ur,p=s&255,g=o&255;let x=0,_=0,y=0,w=.5-c*c-l*l;if(w>0){const E=(n[p+n[g]]&7)*2;w*=w,x=w*w*(As[E]*c+As[E+1]*l)}let T=.5-f*f-u*u;if(T>0){const E=(n[p+h+n[g+d]]&7)*2;T*=T,_=T*T*(As[E]*f+As[E+1]*u)}let R=.5-m*m-v*v;if(R>0){const E=(n[p+1+n[g+1]]&7)*2;R*=R,y=R*R*(As[E]*m+As[E+1]*v)}return 70*(x+_+y)}fbm(t,e,n=5,i=2.03,s=.5){let o=1,a=1,c=0,l=0;for(let h=0;h<n;h++)c+=o*this.noise(t*a,e*a),l+=o,o*=s,a*=i;return c/l}ridged(t,e,n=5,i=2,s=.5){let o=1,a=1,c=0,l=0,h=1;for(let d=0;d<n;d++){let f=1-Math.abs(this.noise(t*a,e*a));f*=f,c+=f*o*h,h=f,l+=o,o*=s,a*=i}return c/l}}const Me=(r,t,e)=>r<t?t:r>e?e:r,Fi=(r,t,e)=>r+(t-r)*e,ie=(r,t,e)=>{const n=Me((e-r)/(t-r),0,1);return n*n*(3-2*n)},ue=(r,t,e,n)=>Fi(r,t,1-Math.exp(-e*n));function Ls(r,t,e,n){let i=t-r;for(;i>Math.PI;)i-=Math.PI*2;for(;i<-Math.PI;)i+=Math.PI*2;return r+i*(1-Math.exp(-e*n))}function _u(r,t,e){let n=1/0,i=0,s=0,o=0;for(let a=0;a<e.length-1;a++)o+=Math.hypot(e[a+1][0]-e[a][0],e[a+1][1]-e[a][1]);for(let a=0;a<e.length-1;a++){const[c,l]=e[a],[h,d]=e[a+1],f=h-c,u=d-l,m=f*f+u*u,v=Math.sqrt(m);let p=((r-c)*f+(t-l)*u)/m;p=Me(p,0,1);const g=c+f*p,x=l+u*p,_=Math.hypot(r-g,t-x);_<n&&(n=_,i=(s+p*v)/o),s+=v}return{d:n,t:i}}const Xt={start:{x:0,z:0},bethlehem:{x:-260,z:-330,r:78},wadi:[[-430,170],[-300,118],[-170,100],[-60,104],[30,122],[120,150],[230,196],[330,262],[440,330]],path:[[4,8],[-18,-40],[-52,-96],[-96,-150],[-140,-196],[-176,-236],[-206,-270],[-226,-296]],pasture:{x:22,z:46,r:20},targets:{x:-54,z:92},stones:{x:-32,z:104},thicket:{x:150,z:-10,r:36},bearLair:{x:200,z:-50},rachel:{x:-150,z:-198},threshing:{x:-176,z:-262},playRadius:330},Ni={elevation:13,azimuth:100,endElevation:17},re=420,yn=9500,ki=new Qs(1337),Ui=new Qs(4242),Us=new Qs(99),Rs={h:0,terrace:0,rock:0,wadi:0,path:0};let z0=0;function Il(r,t){let e=26*ki.fbm(r/700,t/700,4)+12*ki.fbm(r/260+11,t/260-7,4)+3.2*Ui.fbm(r/80,t/80,3)+9*(Ui.ridged(r/520,t/520,3)-.45);const n=ie(260,900,Math.hypot(r,t));if(n>0){const h=1-ie(0,.16,Math.abs(Us.fbm(r/700+7,t/700-3,4))),d=1-ie(0,.12,Math.abs(ki.fbm(r/330-2,t/330+5,3)));e-=n*(34*h+14*d),e+=n*22*(Ui.ridged(r/800+3,t/800,4)-.4)}const i=Math.hypot(r-Xt.bethlehem.x,t-Xt.bethlehem.z);e+=44*Math.exp(-((i/270)**2));const s=r*r+t*t;e+=3.4*Math.exp(-s/(2*13*13));const o=ie(260,3900,r);e-=o*330;const a=o*(1-ie(3800,4300,r));e+=a*70*(Us.ridged(r/620,t/380,5)-.42);const c=ie(3950,4350,r)*(1-ie(5250,5650,r));e=Fi(e,-352,c);const l=ie(5350,6400,r);return e=Fi(e,170+110*Us.ridged(t/1100,r/900,4)+40*ki.fbm(t/300,r/300,3),l),e+=ie(700,4200,t)*90*(.6+.4*Ui.fbm(r/900,t/900,3)),e+=ie(-500,-4500,r)*60*(.6+.4*ki.fbm(r/800,t/800+3,3)),e}function lx(){z0=Il(Xt.bethlehem.x,Xt.bethlehem.z)+1.5}function Nl(r,t){let e=Il(r,t);const n=Xt,i=Math.hypot(r-n.bethlehem.x,t-n.bethlehem.z),s=Math.hypot(r-n.start.x,t-n.start.z),o=Math.hypot(r-n.pasture.x,t-n.pasture.z),a=Math.hypot(r-n.thicket.x,t-n.thicket.z),c=ie(n.bethlehem.r+55,n.bethlehem.r-5,i);e=Fi(e,z0+.9*Ui.noise(r/26,t/26),c);let l=999,h=999;Math.abs(r)<900&&Math.abs(t)<900&&(l=_u(r,t,n.wadi).d+ki.noise(r/40,t/40)*3.5,h=_u(r,t,n.path).d+Ui.noise(r/12,t/12)*.6);let d=ie(n.bethlehem.r+8,n.bethlehem.r+40,i)*(1-ie(n.bethlehem.r+200,n.bethlehem.r+330,i))+ie(.12,.34,Us.fbm(r/260-4,t/260+8,3))*.85;if(d=Me(d,0,1),d*=ie(42,80,s)*ie(30,55,o)*ie(40,70,a),d*=ie(12,34,l)*ie(3,8,h),d*=1-ie(1500,2600,Math.hypot(r,t)),d>.001){const p=e/2.3,g=p-Math.floor(p),x=(Math.floor(p)+.1*g+.9*ie(.86,1,g))*2.3;e=Fi(e,x,d)}if(l<40){const v=7.5*Math.pow(1-ie(4.5,30,l),1.35);e-=v,e+=(1-ie(0,5,l))*.25*ki.noise(r/3,t/3)}const f=1-ie(4.5,9,l),u=1-ie(.7,2.1,h);e-=u*.1;let m=ie(.2,.5,Ui.fbm(r/55+3,t/55-9,4))*.85;return m+=Math.exp(-(s*s)/(2*7*7))*.95,m*=(1-d*.65)*(1-u)*(1-c*.8),m*=ie(8,16,o)*.8+.2,m=Me(m,0,1),e+=m*1.1*(ki.ridged(r/6.5,t/6.5,3)-.3),Rs.h=e,Rs.terrace=d,Rs.rock=m,Rs.wadi=f,Rs.path=u,Rs}class hx{constructor(t){b(this,"group",new Ie);b(this,"nearN");b(this,"nearSpacing");b(this,"heights");b(this,"masks");b(this,"grassDensity");b(this,"farN");b(this,"farHeights");b(this,"heightTexture");b(this,"material");b(this,"nearGeo");b(this,"farGeo");lx(),this.nearSpacing=t.nearSpacing,this.nearN=Math.floor(re*2/t.nearSpacing)+1;const e=this.nearN;this.heights=new Float32Array(e*e),this.masks=new Float32Array(e*e*4),this.grassDensity=new Float32Array(e*e);for(let s=0;s<e;s++){const o=-re+s*t.nearSpacing;for(let a=0;a<e;a++){const c=-re+a*t.nearSpacing,l=Nl(c,o),h=s*e+a;this.heights[h]=l.h,this.masks[h*4]=l.terrace,this.masks[h*4+1]=l.rock,this.masks[h*4+2]=l.wadi,this.masks[h*4+3]=l.path}}this.farN=t.farSegments+1,this.farHeights=new Float32Array(this.farN*this.farN);const n=yn*2/t.farSegments;for(let s=0;s<this.farN;s++)for(let o=0;o<this.farN;o++){const a=-yn+o*n,c=-yn+s*n;this.farHeights[s*this.farN+o]=dx(a,c)}for(let s=0;s<e;s++)for(let o=0;o<e;o++){const a=s*e+o,c=this.slopeAtGrid(o,s),l=a*4,h=-re+o*t.nearSpacing,d=-re+s*t.nearSpacing,f=this.masks[l]*ie(.3,.55,c);let u=(1-this.masks[l+1]*.9)*(1-this.masks[l+2])*(1-this.masks[l+3])*(1-f);u*=1-ie(.55,.85,c),u*=.55+.45*ie(-.3,.3,Us.noise(h/18,d/18));const m=Math.hypot(h-Xt.bethlehem.x,d-Xt.bethlehem.z);u*=ie(Xt.bethlehem.r-10,Xt.bethlehem.r+30,m)*.8+.2,this.grassDensity[a]=Me(u,0,1)}const i=new Float32Array(e*e*2);for(let s=0;s<e*e;s++)i[s*2]=this.heights[s],i[s*2+1]=this.grassDensity[s];this.heightTexture=new El(i,e,e,vl,fn),this.heightTexture.minFilter=en,this.heightTexture.magFilter=en,this.heightTexture.needsUpdate=!0}slopeAtGrid(t,e){const n=this.nearN,i=Math.max(0,t-1),s=Math.min(n-1,t+1),o=Math.max(0,e-1),a=Math.min(n-1,e+1),c=(this.heights[e*n+s]-this.heights[e*n+i])/((s-i)*this.nearSpacing),l=(this.heights[a*n+t]-this.heights[o*n+t])/((a-o)*this.nearSpacing);return 1-1/Math.sqrt(c*c+l*l+1)}heightAt(t,e){const n=this.nearN,i=(t+re)/this.nearSpacing,s=(e+re)/this.nearSpacing;if(i<0||s<0||i>=n-1||s>=n-1)return this.farHeightAt(t,e);const o=Math.floor(i),a=Math.floor(s),c=i-o,l=s-a,h=this.heights[a*n+o],d=this.heights[a*n+o+1],f=this.heights[(a+1)*n+o],u=this.heights[(a+1)*n+o+1];return c+l<=1?h+(d-h)*c+(f-h)*l:u+(f-u)*(1-c)+(d-u)*(1-l)}farHeightAt(t,e){const n=this.farN,i=yn*2/(n-1),s=Me((t+yn)/i,0,n-1.001),o=Me((e+yn)/i,0,n-1.001),a=Math.floor(s),c=Math.floor(o),l=s-a,h=o-c,d=this.farHeights[c*n+a],f=this.farHeights[c*n+a+1],u=this.farHeights[(c+1)*n+a],m=this.farHeights[(c+1)*n+a+1];return Fi(Fi(d,f,l),Fi(u,m,l),h)}normalAt(t,e,n=new A){const i=this.nearSpacing,s=this.heightAt(t+i,e)-this.heightAt(t-i,e),o=this.heightAt(t,e+i)-this.heightAt(t,e-i);return n.set(-s,2*i,-o).normalize()}maskAt(t,e){const n=this.nearN,i=Me(Math.round((t+re)/this.nearSpacing),0,n-1),s=Me(Math.round((e+re)/this.nearSpacing),0,n-1),o=(s*n+i)*4;return{terrace:this.masks[o],rock:this.masks[o+1],wadi:this.masks[o+2],path:this.masks[o+3],grass:this.grassDensity[s*n+i]}}slopeAt(t,e){return 1-this.normalAt(t,e,ux).y}build(t,e){this.material=px(t),this.nearGeo=this.buildNearGeometry(),this.farGeo=this.buildFarGeometry(),this.bakeSun(e);const n=new Ht(this.nearGeo,this.material);n.receiveShadow=!0,n.castShadow=!0,n.name="terrain-near";const i=new Ht(this.farGeo,this.material);i.receiveShadow=!0,i.name="terrain-far",this.group.add(n,i);const s=new vi(1800,9e3,1,1);s.rotateX(-Math.PI/2);const o=new Ht(s,new de({color:8362662,roughness:.12,metalness:0,envMapIntensity:1.6}));o.position.set(4800,-349,0),this.group.add(o)}buildNearGeometry(){const t=this.nearN,e=this.nearSpacing,n=4*(t-1),i=t*t+n,s=new Float32Array(i*3),o=new Float32Array(i*3),a=new Float32Array(i*4),c=new Float32Array(i).fill(1);for(let u=0;u<t;u++)for(let m=0;m<t;m++){const v=u*t+m,p=-re+m*e,g=-re+u*e;s[v*3]=p,s[v*3+1]=this.heights[v],s[v*3+2]=g;const x=Math.max(0,m-1),_=Math.min(t-1,m+1),y=Math.max(0,u-1),w=Math.min(t-1,u+1),T=(this.heights[u*t+_]-this.heights[u*t+x])/((_-x)*e),R=(this.heights[w*t+m]-this.heights[y*t+m])/((w-y)*e),E=Math.sqrt(T*T+R*R+1);o[v*3]=-T/E,o[v*3+1]=1/E,o[v*3+2]=-R/E,a.set(this.masks.subarray(v*4,v*4+4),v*4)}const l=[];for(let u=0;u<t-1;u++)l.push(u);for(let u=0;u<t-1;u++)l.push(u*t+(t-1));for(let u=t-1;u>0;u--)l.push((t-1)*t+u);for(let u=t-1;u>0;u--)l.push(u*t);l.forEach((u,m)=>{const v=t*t+m;s[v*3]=s[u*3],s[v*3+1]=s[u*3+1]-14,s[v*3+2]=s[u*3+2],o.set(o.subarray(u*3,u*3+3),v*3),a.set(a.subarray(u*4,u*4+4),v*4)});const h=new Uint32Array((t-1)*(t-1)*6+l.length*6);let d=0;for(let u=0;u<t-1;u++)for(let m=0;m<t-1;m++){const v=u*t+m,p=v+1,g=v+t,x=g+1;h[d++]=v,h[d++]=g,h[d++]=p,h[d++]=g,h[d++]=x,h[d++]=p}for(let u=0;u<l.length;u++){const m=l[u],v=l[(u+1)%l.length],p=t*t+u,g=t*t+(u+1)%l.length;h[d++]=m,h[d++]=p,h[d++]=v,h[d++]=v,h[d++]=p,h[d++]=g}const f=new ge;return f.setAttribute("position",new te(s,3)),f.setAttribute("normal",new te(o,3)),f.setAttribute("aMask",new te(a,4)),f.setAttribute("aSun",new te(c,1)),f.setIndex(new te(h,1)),f.computeBoundingSphere(),f}buildFarGeometry(){const t=this.farN,e=yn*2/(t-1),n=new Float32Array(t*t*3),i=new Float32Array(t*t*3),s=new Float32Array(t*t*4),o=new Float32Array(t*t).fill(1),a=re-2;for(let h=0;h<t;h++)for(let d=0;d<t;d++){const f=h*t+d,u=-yn+d*e,m=-yn+h*e;let v=this.farHeights[f];Math.abs(u)<a&&Math.abs(m)<a&&(v-=9),n[f*3]=u,n[f*3+1]=v,n[f*3+2]=m;const p=Math.max(0,d-1),g=Math.min(t-1,d+1),x=Math.max(0,h-1),_=Math.min(t-1,h+1),y=(this.farHeights[h*t+g]-this.farHeights[h*t+p])/((g-p)*e),w=(this.farHeights[_*t+d]-this.farHeights[x*t+d])/((_-x)*e),T=Math.sqrt(y*y+w*w+1);i[f*3]=-y/T,i[f*3+1]=1/T,i[f*3+2]=-w/T;const R=fx(u,m);s[f*4]=R.terrace,s[f*4+1]=R.rock,s[f*4+2]=R.desert,s[f*4+3]=0}const c=[];for(let h=0;h<t-1;h++)for(let d=0;d<t-1;d++){const f=-yn+d*e,u=f+e,m=-yn+h*e,v=m+e;if(f>-re+1&&u<re-1&&m>-re+1&&v<re-1)continue;const p=h*t+d,g=p+1,x=p+t,_=x+1;c.push(p,x,g,x,_,g)}const l=new ge;return l.setAttribute("position",new te(n,3)),l.setAttribute("normal",new te(i,3)),l.setAttribute("aMask",new te(s,4)),l.setAttribute("aSun",new te(o,1)),l.setIndex(c),l.computeBoundingSphere(),l}bakeSun(t){const e=Math.hypot(t.x,t.z)||1,n=t.x/e,i=t.z/e,s=t.y/e,o=(a,c,l,h,d,f)=>{const u=a.getAttribute("position"),m=a.getAttribute("aSun");for(let v=0;v<c;v++){const p=u.getX(v),g=u.getZ(v),x=Math.abs(p)<re&&Math.abs(g)<re?this.heightAt(p,g):this.farHeightAt(p,g);let _=1,y=0;for(let w=1;w<=l+d;w++){y+=w<=l?h:f;const T=p+n*y,R=g+i*y,D=Math.abs(T)<re&&Math.abs(R)<re?this.heightAt(T,R):this.farHeightAt(T,R),S=(x+.3+y*s-D)/(y*.035+.6);if(S<_&&(_=S),_<=0)break}m.setX(v,Me(_,0,1))}m.needsUpdate=!0};o(this.nearGeo,this.nearN*this.nearN+4*(this.nearN-1),50,4,24,60),o(this.farGeo,this.farN*this.farN,0,0,40,90)}}const ux=new A;function dx(r,t){return Math.abs(r)<1400&&Math.abs(t)<1400?Nl(r,t).h:Il(r,t)}function fx(r,t,e){if(Math.abs(r)<1400&&Math.abs(t)<1400){const o=Nl(r,t);return{terrace:o.terrace,rock:o.rock,desert:0}}const n=ie(500,1800,r)*(1-ie(5200,5800,r)),i=Me(ie(.1,.42,Ui.fbm(r/55+3,t/55-9,3))*.6+n*.3,0,1);return{terrace:r<700?ie(.12,.34,Us.fbm(r/260-4,t/260+8,3))*.7*(1-ie(1500,3500,Math.hypot(r,t))):0,rock:i,desert:n}}function px(r){const t=new de({color:16777215,roughness:.95,metalness:0}),e={tGrass:{value:r.grass},tGrassN:{value:r.grassN},tSoil:{value:r.soil},tSoilN:{value:r.soilN},tRock:{value:r.rock},tRockN:{value:r.rockN},tWall:{value:r.wall},tWallN:{value:r.wallN},uSunDir:ne.uSunDir};return t.onBeforeCompile=n=>{Object.assign(n.uniforms,e),n.vertexShader=n.vertexShader.replace("#include <common>",`#include <common>
attribute vec4 aMask;
attribute float aSun;
varying vec4 vMask;
varying float vSun;
varying vec3 vWPos;
varying vec3 vWNormal;`).replace("#include <project_vertex>",`#include <project_vertex>
vMask = aMask;
vSun = aSun;
vWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
vWNormal = normalize(mat3(modelMatrix) * objectNormal);`),n.fragmentShader=n.fragmentShader.replace("#include <common>",`#include <common>
uniform sampler2D tGrass, tGrassN, tSoil, tSoilN, tRock, tRockN, tWall, tWallN;
varying vec4 vMask;
varying float vSun;
varying vec3 vWPos;
varying vec3 vWNormal;
${N0}
vec3 tNormal(sampler2D t, vec2 uv){ return texture2D(t, uv).xyz * 2.0 - 1.0; }
vec3 terrainNormalW;
float terrainRough;
`).replace("#include <map_fragment>",`{
  vec3 N = normalize(vWNormal);
  float slope = 1.0 - N.y;
  vec2 p = vWPos.xz;
  float dist = length(vWPos - cameraPosition);
  float macro = dFbm(p * 0.018);
  float macro2 = dNoise(p * 0.11);
  float terr = vMask.x, rocky = vMask.y, wadi = vMask.z, path = vMask.w;
  float desert = 0.0;
  if (abs(p.x) > ${re.toFixed(1)} || abs(p.y) > ${re.toFixed(1)}) { desert = wadi; wadi = 0.0; path = 0.0; }

  // ---- grass (golden, dry), two scales to break tiling
  vec2 gUV1 = p / 3.6;
  vec2 gUV2 = p / 11.3 + vec2(0.37, 0.71);
  vec3 grass = mix(texture2D(tGrass, gUV1).rgb, texture2D(tGrass, gUV2).rgb, 0.45);
  grass *= mix(vec3(0.95, 0.98, 0.8), vec3(1.18, 1.06, 0.86), macro); // patchy hue
  // darker garrigue scrub patches (thorny burnet, sage) break up the gold
  float scrub = smoothstep(0.55, 0.75, dNoise(p * 0.05 + 3.0) * 0.7 + dNoise(p * 0.21) * 0.3);
  grass = mix(grass, grass * vec3(0.62, 0.64, 0.5), scrub * 0.55);
  grass = mix(grass, grass * vec3(0.78, 0.74, 0.62), smoothstep(0.55, 0.9, macro2) * 0.6);
  // ---- terra rossa soil
  vec3 soil = texture2D(tSoil, p / 4.2).rgb;
  soil = mix(soil, texture2D(tSoil, p / 13.0 + 0.5).rgb, 0.4);
  // ---- limestone (triplanar)
  vec3 bw = pow(abs(N), vec3(4.0)); bw /= (bw.x + bw.y + bw.z);
  vec3 rp = vWPos / 6.5;
  vec3 rock = texture2D(tRock, rp.zy).rgb * bw.x + texture2D(tRock, rp.xz).rgb * bw.y + texture2D(tRock, rp.xy).rgb * bw.z;
  rock *= mix(0.62, 0.84, macro) * vec3(0.98, 0.96, 0.92);
  // ---- dry-stone terrace walls (side projection)
  vec2 wallUV = (abs(N.x) > abs(N.z) ? vWPos.zy : vWPos.xy) / 3.1;
  vec3 wall = texture2D(tWall, wallUV).rgb;

  // ---- weights with height-blending for crisp natural transitions
  float rockH = dot(rock, vec3(0.33));
  float breakup = dNoise(p * 0.45) * 0.6 + dNoise(p * 1.7) * 0.4; // bedrock breaks through in slabs
  float wRock = clamp(rocky * 1.1 + smoothstep(0.42, 0.62, slope) * (1.0 - terr) + desert * 0.35, 0.0, 1.0);
  wRock = smoothstep(0.45, 0.62, wRock * (0.55 + breakup * 0.9) + (rockH - 0.5) * 0.5);
  float wWall = smoothstep(0.25, 0.5, terr) * smoothstep(0.3, 0.45, slope);
  float wSoil = clamp(path * 1.3 + terr * (1.0 - wWall) * 0.35 + smoothstep(0.62, 0.85, macro) * 0.55, 0.0, 1.0);
  wSoil = smoothstep(0.3, 0.7, wSoil + (macro2 - 0.5) * 0.4);
  vec3 col = mix(grass, soil, wSoil);
  // dusty worn path — lighter compacted earth
  col = mix(col, mix(soil, vec3(0.62, 0.52, 0.40), 0.55), path * 0.8);
  // wadi bed: pale gravel & cobbles
  vec3 gravel = mix(texture2D(tRock, p / 1.7).rgb * vec3(0.95, 0.88, 0.76), soil * 1.15, 0.5);
  col = mix(col, gravel, wadi);
  // exposed bedrock reads as stony, grey-brown ground (the big bright boulders are real 3D rocks)
  vec3 stony = mix(soil * 0.95, rock * 0.8, 0.55 + 0.25 * rockH);
  col = mix(col, stony, wRock * 0.85);
  col = mix(col, wall, wWall);
  // desert far away: bare pinkish-tan chalk
  col = mix(col, mix(vec3(0.74, 0.60, 0.46), rock, 0.35), desert * 0.85);
  // distance: soften high-frequency detail into average colour (reduces shimmer)
  float df = smoothstep(120.0, 900.0, dist);
  vec3 farCol = mix(vec3(0.66, 0.53, 0.33), rock * 0.92, wRock) * mix(0.85, 1.12, macro);
  farCol = mix(farCol, farCol * vec3(0.55, 0.56, 0.44), scrub * 0.7);
  col = mix(col, farCol, df * 0.55);
  col = mix(col, col * 0.86, wRock * (1.0 - rockH) * 0.5);
  // garrigue speckle: dark shrubs dotting the hills, readable at mid/far distance
  float cover = smoothstep(0.25, 0.65, dNoise(p * 0.025 + 4.0));
  float bush = dCellDots(p * 0.45 + 11.0, 0.3) * (0.35 + 0.65 * cover) + dCellDots(p * 0.16 - 5.0, 0.24) * 0.9 * cover + dCellDots(p * 0.07 + 2.0, 0.18) * 0.7;
  bush *= (1.0 - wRock * 0.5) * (1.0 - path) * (1.0 - wadi) * smoothstep(14.0, 45.0, dist);
  vec3 bushCol = mix(vec3(0.19, 0.2, 0.12), vec3(0.3, 0.29, 0.2), dNoise(p * 0.9));
  col = mix(col, bushCol, clamp(bush, 0.0, 1.0) * 0.8);
  diffuseColor.rgb *= col;

  // ---- normals (UDN blend in world space)
  vec3 nG = tNormal(tGrassN, gUV1);
  vec3 nS = tNormal(tSoilN, p / 4.2);
  vec3 nRx = tNormal(tRockN, rp.zy), nRy = tNormal(tRockN, rp.xz), nRz = tNormal(tRockN, rp.xy);
  vec3 nW = tNormal(tWallN, wallUV);
  vec3 tn = mix(nG, nS, wSoil);
  tn = mix(tn, nS, wadi);
  vec3 wn = normalize(N + vec3(tn.x, 0.0, -tn.y) * 0.9);
  vec3 rockN = normalize(
      bw.x * normalize(vec3(0.0, nRx.y, nRx.x) + N) +
      bw.y * normalize(vec3(nRy.x, 0.0, -nRy.y) + N) +
      bw.z * normalize(vec3(nRz.x, nRz.y, 0.0) + N));
  wn = normalize(mix(wn, rockN, wRock));
  vec3 wallN = abs(N.x) > abs(N.z) ? normalize(N + vec3(0.0, nW.y, nW.x * sign(N.x)) * 1.2) : normalize(N + vec3(nW.x * sign(N.z), nW.y, 0.0) * 1.2);
  wn = normalize(mix(wn, wallN, wWall));
  wn = normalize(mix(wn, N, df));
  terrainNormalW = wn;
  terrainRough = mix(0.96, 0.82, wRock);
}`).replace("#include <normal_fragment_maps>","normal = normalize((viewMatrix * vec4(terrainNormalW, 0.0)).xyz);").replace("#include <roughnessmap_fragment>",`#include <roughnessmap_fragment>
roughnessFactor = terrainRough;`).replace("#include <lights_fragment_end>",`#include <lights_fragment_end>
reflectedLight.directDiffuse *= vSun;
reflectedLight.directSpecular *= vSun;
reflectedLight.indirectDiffuse *= mix(0.72, 1.0, vSun);`)},t.customProgramCacheKey=()=>"terrain-v1",t}function kn(r,t=!1){const e=r[0].index!==null,n=new Set(Object.keys(r[0].attributes)),i=new Set(Object.keys(r[0].morphAttributes)),s={},o={},a=r[0].morphTargetsRelative,c=new ge;let l=0;for(let h=0;h<r.length;++h){const d=r[h];let f=0;if(e!==(d.index!==null))return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index "+h+". All geometries must have compatible attributes; make sure index attribute exists among all geometries, or in none of them."),null;for(const u in d.attributes){if(!n.has(u))return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index "+h+'. All geometries must have compatible attributes; make sure "'+u+'" attribute exists among all geometries, or in none of them.'),null;s[u]===void 0&&(s[u]=[]),s[u].push(d.attributes[u]),f++}if(f!==n.size)return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index "+h+". Make sure all geometries have the same number of attributes."),null;if(a!==d.morphTargetsRelative)return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index "+h+". .morphTargetsRelative must be consistent throughout all geometries."),null;for(const u in d.morphAttributes){if(!i.has(u))return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index "+h+".  .morphAttributes must be consistent throughout all geometries."),null;o[u]===void 0&&(o[u]=[]),o[u].push(d.morphAttributes[u])}if(t){let u;if(e)u=d.index.count;else if(d.attributes.position!==void 0)u=d.attributes.position.count;else return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index "+h+". The geometry must have either an index or a position attribute"),null;c.addGroup(l,u,h),l+=u}}if(e){let h=0;const d=[];for(let f=0;f<r.length;++f){const u=r[f].index;for(let m=0;m<u.count;++m)d.push(u.getX(m)+h);h+=r[f].attributes.position.count}c.setIndex(d)}for(const h in s){const d=yu(s[h]);if(!d)return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed while trying to merge the "+h+" attribute."),null;c.setAttribute(h,d)}for(const h in o){const d=o[h][0].length;if(d===0)break;c.morphAttributes=c.morphAttributes||{},c.morphAttributes[h]=[];for(let f=0;f<d;++f){const u=[];for(let v=0;v<o[h].length;++v)u.push(o[h][v][f]);const m=yu(u);if(!m)return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed while trying to merge the "+h+" morphAttribute."),null;c.morphAttributes[h].push(m)}}return c}function yu(r){let t,e,n,i=-1,s=0;for(let l=0;l<r.length;++l){const h=r[l];if(t===void 0&&(t=h.array.constructor),t!==h.array.constructor)return console.error("THREE.BufferGeometryUtils: .mergeAttributes() failed. BufferAttribute.array must be of consistent array types across matching attributes."),null;if(e===void 0&&(e=h.itemSize),e!==h.itemSize)return console.error("THREE.BufferGeometryUtils: .mergeAttributes() failed. BufferAttribute.itemSize must be consistent across matching attributes."),null;if(n===void 0&&(n=h.normalized),n!==h.normalized)return console.error("THREE.BufferGeometryUtils: .mergeAttributes() failed. BufferAttribute.normalized must be consistent across matching attributes."),null;if(i===-1&&(i=h.gpuType),i!==h.gpuType)return console.error("THREE.BufferGeometryUtils: .mergeAttributes() failed. BufferAttribute.gpuType must be consistent across matching attributes."),null;s+=h.count*e}const o=new t(s),a=new te(o,e,n);let c=0;for(let l=0;l<r.length;++l){const h=r[l];if(h.isInterleavedBufferAttribute){const d=c/e;for(let f=0,u=h.count;f<u;f++)for(let m=0;m<e;m++){const v=h.getComponent(f,m);a.setComponent(f+d,m,v)}}else o.set(h.array,c);c+=h.count*e}return i!==void 0&&(a.gpuType=i),a}function $o(r,t=1e-4){t=Math.max(t,Number.EPSILON);const e={},n=r.getIndex(),i=r.getAttribute("position"),s=n?n.count:i.count;let o=0;const a=Object.keys(r.attributes),c={},l={},h=[],d=["getX","getY","getZ","getW"],f=["setX","setY","setZ","setW"];for(let x=0,_=a.length;x<_;x++){const y=a[x],w=r.attributes[y];c[y]=new w.constructor(new w.array.constructor(w.count*w.itemSize),w.itemSize,w.normalized);const T=r.morphAttributes[y];T&&(l[y]||(l[y]=[]),T.forEach((R,E)=>{const D=new R.array.constructor(R.count*R.itemSize);l[y][E]=new R.constructor(D,R.itemSize,R.normalized)}))}const u=t*.5,m=Math.log10(1/t),v=Math.pow(10,m),p=u*v;for(let x=0;x<s;x++){const _=n?n.getX(x):x;let y="";for(let w=0,T=a.length;w<T;w++){const R=a[w],E=r.getAttribute(R),D=E.itemSize;for(let M=0;M<D;M++)y+=`${~~(E[d[M]](_)*v+p)},`}if(y in e)h.push(e[y]);else{for(let w=0,T=a.length;w<T;w++){const R=a[w],E=r.getAttribute(R),D=r.morphAttributes[R],M=E.itemSize,S=c[R],k=l[R];for(let N=0;N<M;N++){const z=d[N],H=f[N];if(S[H](o,E[z](_)),D)for(let L=0,V=D.length;L<V;L++)k[L][H](o,D[L][z](_))}}e[y]=o,h.push(o),o++}}const g=r.clone();for(const x in r.attributes){const _=c[x];if(g.setAttribute(x,new _.constructor(_.array.slice(0,o*_.itemSize),_.itemSize,_.normalized)),x in l)for(let y=0;y<l[x].length;y++){const w=l[x][y];g.morphAttributes[x][y]=new w.constructor(w.array.slice(0,o*w.itemSize),w.itemSize,w.normalized)}}return g.setIndex(h),g}const il=new Qs(777);function kr(r,t,e,n,i,s,o){const a=new Cl(r,!1,"catmullrom",.5),c=new sa(a,n,1,i,!1),l=c.getAttribute("position"),h=c.getAttribute("uv"),d=a.getLength(),f=new A,u=new A;for(let m=0;m<=n;m++){const v=m/n;a.getPointAt(v,f);let p=Bt.lerp(t,e,Math.pow(v,.8));p*=1+.55*Math.exp(-v*9)*(t>.15?1:0);for(let g=0;g<=i;g++){const x=m*(i+1)+g;u.fromBufferAttribute(l,x).sub(f);const _=g/i*Math.PI*2,y=il.noise(Math.cos(_)*1.3+o,v*d*1.4+Math.sin(_)*1.3)*s+il.noise(_*2+o*3,v*d*4)*s*.35;u.multiplyScalar(p*(1+y)),l.setXYZ(x,f.x+u.x,f.y+u.y,f.z+u.z),h.setXY(x,g/i*Math.max(1,Math.round(p*6)),v*d/1.3)}}return c.computeVertexNormals(),c}function Ko(r,t,e,n,i=3){const s=[];for(let h=0;h<i;h++){const d=new vi(t,t),f=new Ve(n()*Math.PI,n()*Math.PI*2,n()*Math.PI);d.applyMatrix4(new Dt().makeRotationFromEuler(f)),d.translate(r.x,r.y,r.z),s.push(d)}const o=kn(s),a=o.getAttribute("position"),c=o.getAttribute("normal"),l=new A;for(let h=0;h<a.count;h++)l.fromBufferAttribute(a,h).sub(e),l.y*=.6,l.normalize().lerp(new A(0,1,0),.25).normalize(),c.setXYZ(h,l.x,l.y,l.z);return o}function mx(r){const t=Gn(r),e=[],n=[],i=2+Math.floor(t()*2),s=new A(0,3.3+t()*.6,0),o=[];for(let a=0;a<i;a++){const c=a/i*Math.PI*2+t(),l=.35+t()*.5,h=1.5+t()*.8,d=new A(Math.cos(c)*.12,-.3,Math.sin(c)*.12),f=new A(Math.cos(c+.8)*l*.5,h*.5,Math.sin(c+.8)*l*.5),u=new A(Math.cos(c)*l,h,Math.sin(c)*l);e.push(kr([d,d.clone().setY(.3),f,u],.24-a*.03,.13,14,9,.28,r+a));const m=2+Math.floor(t()*2);for(let v=0;v<m;v++){const p=c+(t()-.5)*2.2,g=1.3+t()*1.1,x=u.clone().add(new A(Math.cos(p)*g,.9+t()*1.1,Math.sin(p)*g)),_=u.clone().lerp(x,.5).add(new A(0,.25,0));e.push(kr([u.clone().add(new A(0,-.1,0)),_,x],.11,.035,8,6,.18,r*7+v)),o.push(x,_)}}for(const a of o){const c=2+Math.floor(t()*2);for(let l=0;l<c;l++){const h=a.clone().add(new A((t()-.5)*1.4,(t()-.2)*.9,(t()-.5)*1.4));n.push(Ko(h,1.5+t()*.9,s,t))}}for(let a=0;a<10;a++){const c=t()*Math.PI*2,l=.8+t()*1.6,h=s.clone().add(new A(Math.cos(c)*l,(t()-.3)*1.2,Math.sin(c)*l));n.push(Ko(h,1.7+t()*.8,s,t))}return{bark:kn(e),leaves:kn(n),height:5,trunkR:.45}}function gx(r){const t=Gn(r),e=[],n=[],i=1.6+t()*.7,s=new A((t()-.5)*.5,i,(t()-.5)*.5);e.push(kr([new A(0,-.3,0),new A(0,.5,0),s],.3,.2,10,9,.18,r));const o=new A(0,i+1.7,0),a=4+Math.floor(t()*3);for(let c=0;c<a;c++){const l=c/a*Math.PI*2+t()*.6,h=1.6+t()*1,d=s.clone().add(new A(Math.cos(l)*h,1.2+t()*1.2,Math.sin(l)*h)),f=s.clone().lerp(d,.45).add(new A(0,.2,0));e.push(kr([s.clone().add(new A(0,-.2,0)),f,d],.14,.04,8,6,.15,r*3+c));for(let u=0;u<4;u++){const m=d.clone().lerp(f,t()*.6).add(new A((t()-.5)*1.6,(t()-.3)*1,(t()-.5)*1.6));n.push(Ko(m,1.8+t()*.8,o,t))}}for(let c=0;c<14;c++){const l=t()*Math.PI*2,h=t()*2.3,d=o.clone().add(new A(Math.cos(l)*h,(t()-.4)*1.6,Math.sin(l)*h));n.push(Ko(d,2+t()*.8,o,t))}return{bark:kn(e),leaves:kn(n),height:5.5,trunkR:.5}}function Mu(r){const t=Gn(r),e=[],n=new A(0,.3,0);for(let l=0;l<3;l++){const h=new vi(1,.8);h.rotateY(l/3*Math.PI+t()*.3),h.rotateZ((t()-.5)*.3),h.translate(0,.3,0),e.push(h)}const i=new vi(.95,.95);i.rotateX(-Math.PI/2+.25),i.translate(0,.55,0),e.push(i);const s=kn(e),o=s.getAttribute("position"),a=s.getAttribute("normal"),c=new A;for(let l=0;l<o.count;l++)c.fromBufferAttribute(o,l).sub(n).normalize().lerp(new A(0,1,0),.4).normalize(),a.setXYZ(l,c.x,c.y,c.z);return s}function Za(r,t){const e=new de({map:r,alphaTest:.45,side:cn,roughness:.82,metalness:0,color:t.color??16777215});return e.onBeforeCompile=n=>{n.uniforms.uTime=ne.uTime,n.uniforms.uSunDir=ne.uSunDir,n.uniforms.uSunColor=ne.uSunColor,n.uniforms.uWindStrength=ne.uWindStrength,n.vertexShader=n.vertexShader.replace("#include <common>",`#include <common>
uniform float uTime; uniform float uWindStrength; varying vec3 vFolWPos;`).replace("#include <begin_vertex>",`#include <begin_vertex>
{
  vec3 ip = vec3(0.0);
  #ifdef USE_INSTANCING
  ip = instanceMatrix[3].xyz;
  #endif
  float hgt = max(position.y, 0.0);
  float ph = ip.x * 0.11 + ip.z * 0.07;
  float sway = sin(uTime * 1.1 + ph) * 0.6 + sin(uTime * 2.3 + ph * 1.7) * 0.4;
  transformed.x += sway * ${t.sway.toFixed(3)} * hgt * uWindStrength;
  transformed.z += sway * ${(t.sway*.5).toFixed(3)} * hgt * uWindStrength;
  float fl = sin(uTime * 7.0 + dot(position, vec3(3.1, 2.3, 4.7)) + ph) * ${t.flutter.toFixed(3)} * uWindStrength;
  transformed += normal * fl;
}`).replace("#include <project_vertex>",`#include <project_vertex>
{
  vec4 wp = vec4(transformed, 1.0);
  #ifdef USE_INSTANCING
  wp = instanceMatrix * wp;
  #endif
  vFolWPos = (modelMatrix * wp).xyz;
}`),n.fragmentShader=n.fragmentShader.replace("#include <common>",`#include <common>
uniform vec3 uSunDir; uniform vec3 uSunColor; varying vec3 vFolWPos;`).replace("#include <emissivemap_fragment>",`#include <emissivemap_fragment>
{
  vec3 vd = normalize(vFolWPos - cameraPosition);
  float back = pow(max(dot(vd, uSunDir), 0.0), 3.0);
  totalEmissiveRadiance += diffuseColor.rgb * uSunColor * back * ${t.translucency.toFixed(3)};
}`)},e.customProgramCacheKey=()=>`foliage-${t.sway}-${t.flutter}-${t.translucency}`,e}class vx{constructor(t,e,n,i){b(this,"group",new Ie);b(this,"trees",[]);this.terrain=t,this.tex=e,this.colliders=n,this.quality=i}build(){const t=new de({map:this.tex.bark,normalMap:this.tex.barkN,roughness:.95,color:14209220});t.normalScale.set(1.2,1.2);const e=Za(this.tex.olive,{sway:.012,flutter:.02,translucency:.55}),n=Za(this.tex.oak,{sway:.008,flutter:.015,translucency:.45}),i=Za(this.tex.shrub,{sway:.02,flutter:.01,translucency:.35}),s=[0,1,2,3].map(_=>mx(101+_*17)),o=[0,1,2].map(_=>gx(301+_*23)),a=Gn(2024),c=s.map(()=>[]),l=o.map(()=>[]),h=Xt,d=(_,y,w)=>this.colliders.free(_,y,w),f=Math.round(620*this.quality.treeScale);for(let _=0;_<f*25&&this.trees.length<f;_++){const y=(a()*2-1)*(re-8),w=(a()*2-1)*(re-8),T=this.terrain.maskAt(y,w);if(this.terrain.slopeAt(y,w)>.22||T.path>.1||T.wadi>.05||Math.hypot(y-h.pasture.x,w-h.pasture.z)<h.pasture.r+8||Math.hypot(y-h.start.x,w-h.start.z)<14||Math.hypot(y-h.targets.x,w-h.targets.z)<12)continue;const E=Math.hypot(y-h.bethlehem.x,w-h.bethlehem.z);if(E<h.bethlehem.r-4)continue;const D=T.terrace*.75+.04+(E<h.bethlehem.r+160?.1:0);if(a()>D||!d(y,w,6.5))continue;const M=Math.floor(a()*s.length),S=.8+a()*.45,k=this.terrain.heightAt(y,w);c[M].push(new Dt().compose(new A(y,k,w),new De().setFromEuler(new Ve(0,a()*Math.PI*2,0)),new A(S,S*(.9+a()*.2),S))),this.colliders.add({x:y,z:w,r:.42*S,tag:"tree"}),this.trees.push({x:y,z:w,kind:"olive"})}let u=0;for(let _=0;_<6e3&&u<90*this.quality.treeScale+20;_++){let y,w;if(a()<.55){const M=a()*Math.PI*2,S=Math.sqrt(a())*(h.thicket.r+25);y=h.thicket.x+Math.cos(M)*S+20,w=h.thicket.z+Math.sin(M)*S*.8-12}else if(y=(a()*2-1)*(re-8),w=(a()*2-1)*(re-8),!(this.terrain.maskAt(y,w).wadi>0||a()<.06))continue;const T=this.terrain.maskAt(y,w);if(T.path>.1||T.wadi>.4||Math.hypot(y-h.pasture.x,w-h.pasture.z)<h.pasture.r+10||Math.hypot(y-h.start.x,w-h.start.z)<16||Math.hypot(y-h.thicket.x,w-h.thicket.z)<16||Math.hypot(y-h.bethlehem.x,w-h.bethlehem.z)<h.bethlehem.r||!d(y,w,4.2))continue;const R=Math.floor(a()*o.length),E=.8+a()*.5,D=this.terrain.heightAt(y,w);l[R].push(new Dt().compose(new A(y,D,w),new De().setFromEuler(new Ve(0,a()*Math.PI*2,0)),new A(E,E,E))),this.colliders.add({x:y,z:w,r:.45*E,tag:"tree"}),this.trees.push({x:y,z:w,kind:"oak"}),u++}const m=(_,y,w)=>{_.forEach((T,R)=>{if(!y[R].length)return;const E=new Ii(T.bark,t,y[R].length),D=new Ii(T.leaves,w,y[R].length);y[R].forEach((M,S)=>{E.setMatrixAt(S,M),D.setMatrixAt(S,M)}),E.castShadow=D.castShadow=!0,E.receiveShadow=D.receiveShadow=!0,E.computeBoundingSphere(),D.computeBoundingSphere(),this.group.add(E,D)})};m(s,c,e),m(o,l,n);const v=[Mu(5),Mu(6)],p=[[],[]],g=this.quality.shrubs;let x=0;for(let _=0;_<g*12&&x<g;_++){const y=(a()*2-1)*(re-4),w=(a()*2-1)*(re-4),T=this.terrain.maskAt(y,w);if(T.path>.2||T.wadi>.6||Math.hypot(y-h.pasture.x,w-h.pasture.z)<9||Math.hypot(y-h.bethlehem.x,w-h.bethlehem.z)<h.bethlehem.r)continue;const R=.25+T.rock*.6+(1-T.grass)*.2;if(a()>R||!this.colliders.free(y,w,.4))continue;const E=.6+a()*.9,D=this.terrain.heightAt(y,w)-.05,M=a()<.5?0:1;p[M].push(new Dt().compose(new A(y,D,w),new De().setFromEuler(new Ve(0,a()*Math.PI*2,0)),new A(E,E*(.7+a()*.5),E))),x++}v.forEach((_,y)=>{const w=new Ii(_,i,p[y].length);p[y].forEach((T,R)=>w.setMatrixAt(R,T)),w.castShadow=!0,w.receiveShadow=!0,w.computeBoundingSphere(),this.group.add(w)}),this.buildFarTrees(a)}buildFarTrees(t){const e=new qs(1,1);e.scale(2.6,2,2.6),e.translate(0,2.2,0);const n=new de({color:5067826,roughness:1}),i=this.quality.farTrees,s=new Ii(e,n,i),o=new dt;let a=0;for(let c=0;c<i*30&&a<i;c++){const l=re*.9+Math.pow(t(),1.4)*3200,h=t()*Math.PI*2,d=Math.cos(h)*l,f=Math.sin(h)*l;if(Math.abs(d)<re&&Math.abs(f)<re||d>900+t()*600||Math.abs(d)>yn||Math.abs(f)>yn)continue;const u=ie(.1,.3,il.fbm(d/260-4,f/260+8,3));if(t()>.08+u*.85)continue;const m=this.terrain.farHeightAt(d,f)-.5,v=.8+t()*.6;s.setMatrixAt(a,new Dt().compose(new A(d,m,f),new De,new A(v,v,v))),s.setColorAt(a,o.setHSL(.19+t()*.04,.25,.22+t()*.08)),a++}s.count=a,s.computeBoundingSphere(),s.receiveShadow=!1,this.group.add(s)}}const Ja=new Qs(555);function Ul(r,t=4){const e=$o(new qs(1,t).deleteAttribute("normal").deleteAttribute("uv")),n=e.getAttribute("position"),i=new A,s=r*13.7;for(let o=0;o<n.count;o++){i.fromBufferAttribute(n,o);const a=Ja.noise(i.x*1.2+s,i.y*1.2+i.z*.7)+Ja.noise(i.z*1.3-s,i.y*1.1+i.x*.6),c=Ja.noise(i.x*3.5+s,i.z*3.5+i.y)*.35;let l=1+a*.22+c*.25;i.y>.45&&(l*=1-(i.y-.45)*.45),i.multiplyScalar(l),i.y*=.62,n.setXYZ(o,i.x,i.y,i.z)}return e.computeVertexNormals(),e}function zl(r,t=16777215){const e=new de({color:t,roughness:.88,metalness:0});return e.onBeforeCompile=n=>{n.uniforms.tRock={value:r.rock},n.uniforms.tRockN={value:r.rockN},n.vertexShader=n.vertexShader.replace("#include <common>",`#include <common>
varying vec3 vRWPos; varying vec3 vRWNormal;`).replace("#include <project_vertex>",`#include <project_vertex>
{
  vec4 wp = vec4(transformed, 1.0);
  vec3 wn = objectNormal;
  #ifdef USE_INSTANCING
  wp = instanceMatrix * wp;
  wn = mat3(instanceMatrix) * wn;
  #endif
  vRWPos = (modelMatrix * wp).xyz;
  vRWNormal = normalize(mat3(modelMatrix) * wn);
}`),n.fragmentShader=n.fragmentShader.replace("#include <common>",`#include <common>
uniform sampler2D tRock; uniform sampler2D tRockN; varying vec3 vRWPos; varying vec3 vRWNormal; vec3 rockWN;`).replace("#include <map_fragment>",`{
  vec3 Nw = normalize(vRWNormal);
  vec3 bw = pow(abs(Nw), vec3(4.0)); bw /= (bw.x + bw.y + bw.z);
  vec3 p = vRWPos / 2.6;
  vec3 c = texture2D(tRock, p.zy).rgb * bw.x + texture2D(tRock, p.xz).rgb * bw.y + texture2D(tRock, p.xy).rgb * bw.z;
  // darker, dusty underside; sun-bleached tops
  c *= mix(0.72, 1.08, smoothstep(-0.6, 0.8, Nw.y));
  diffuseColor.rgb *= c;
  vec3 nx = texture2D(tRockN, p.zy).xyz * 2.0 - 1.0;
  vec3 ny = texture2D(tRockN, p.xz).xyz * 2.0 - 1.0;
  vec3 nz = texture2D(tRockN, p.xy).xyz * 2.0 - 1.0;
  rockWN = normalize(bw.x * normalize(vec3(0.0, nx.y, nx.x) + Nw) + bw.y * normalize(vec3(ny.x, 0.0, -ny.y) + Nw) + bw.z * normalize(vec3(nz.x, nz.y, 0.0) + Nw));
}`).replace("#include <normal_fragment_maps>","normal = normalize((viewMatrix * vec4(rockWN, 0.0)).xyz);")},e.customProgramCacheKey=()=>"rock-triplanar",e}class xx{constructor(t,e,n,i){b(this,"group",new Ie);b(this,"material");this.terrain=t,this.colliders=n,this.count=i,this.material=zl(e)}build(){const t=[0,1,2,3,4].map(a=>Ul(a+1)),e=t.map(()=>[]),n=Gn(31337),i=Xt;let s=0;const o=(a,c,l,h,d)=>{const f=this.terrain.heightAt(a,c)-l*h,u=Math.floor(n()*t.length),m=new De().setFromEuler(new Ve((n()-.5)*.3,n()*Math.PI*2,(n()-.5)*.3));e[u].push(new Dt().compose(new A(a,f,c),m,new A(l*(.8+n()*.5),l*(.7+n()*.5),l*(.8+n()*.5)))),d&&l>.55&&this.colliders.add({x:a,z:c,r:l*.8,tag:"rock"}),s++};o(i.start.x+1.8,i.start.z-1.2,2.2,.55,!0),o(i.start.x-2.6,i.start.z+.8,1.4,.5,!0),o(i.start.x+.6,i.start.z+3.2,1,.45,!0);for(let a=0;a<this.count*20&&s<this.count;a++){const c=(n()*2-1)*(re-5),l=(n()*2-1)*(re-5),h=this.terrain.maskAt(c,l);if(h.path>.3||Math.hypot(c-i.pasture.x,l-i.pasture.z)<7||Math.hypot(c-i.bethlehem.x,l-i.bethlehem.z)<i.bethlehem.r-5||Math.hypot(c-i.thicket.x,l-i.thicket.z)<10||Math.hypot(c-i.stones.x,l-i.stones.z)<13||Math.hypot(c-i.targets.x,l-i.targets.z)<9)continue;const d=this.terrain.slopeAt(c,l),f=h.terrace*(d>.3?1:0),u=h.rock*h.rock*.9+f*.35+h.wadi*.45+.003;if(n()>u)continue;const m=n()<.12*(h.rock+.2),v=m?1.2+n()*1.8:.18+Math.pow(n(),2)*.9;if(!this.colliders.free(c,l,v*.7))continue;o(c,l,v,.35,!0);const p=m?5:v>.5?2:0;for(let g=0;g<p&&s<this.count;g++){const x=n()*Math.PI*2,_=v*(.9+n()*1.6),y=c+Math.cos(x)*_,w=l+Math.sin(x)*_,T=v*(.15+n()*.35);Math.hypot(y-i.stones.x,w-i.stones.z)<13||Math.hypot(y-i.targets.x,w-i.targets.z)<9||this.colliders.free(y,w,T*.6)&&o(y,w,T,.4,T>.55)}}t.forEach((a,c)=>{if(!e[c].length)return;const l=new Ii(a,this.material,e[c].length);e[c].forEach((h,d)=>l.setMatrixAt(d,h)),l.castShadow=!0,l.receiveShadow=!0,l.computeBoundingSphere(),this.group.add(l)})}}class _x{constructor(t,e,n){b(this,"mesh");const i=Gn(99),s=8,o=3,a=[],c=[],l=[],h=[],d=[],f=new dt,u=new dt,m=[14268778,15258522,12095823,13281382,10328668,14730624];for(let y=0;y<s;y++){const w=i()*Math.PI*2,T=i()*.2,R=Math.cos(w)*T,E=Math.sin(w)*T,D=.12+i()*.24,M=.018+i()*.014,S=.06+i()*.2,k=i()*Math.PI*2,N=Math.cos(k),z=Math.sin(k),H=-z,L=N;u.setHex(m[Math.floor(i()*m.length)]),f.copy(u).multiplyScalar(.55);const V=a.length/3;for(let O=0;O<=o;O++){const P=O/o,B=S*P*P,G=R+N*B,Q=E+z*B,ut=D*P,X=M*(1-P*.92);a.push(G-H*X,ut,Q-L*X,G+H*X,ut,Q+L*X),c.push(0,P,1,P);const Z=f.clone().lerp(u,Math.pow(P,.7));l.push(Z.r,Z.g,Z.b,Z.r,Z.g,Z.b),h.push(N,.6,z,N,.6,z)}for(let O=0;O<o;O++){const P=V+O*2;d.push(P,P+1,P+2,P+1,P+3,P+2)}}const v=new zv;v.setAttribute("position",new $t(a,3)),v.setAttribute("uv",new $t(c,2)),v.setAttribute("color",new $t(l,3)),v.setAttribute("normal",new $t(h,3)),v.setIndex(d);const p=new Float32Array(e*2),g=new Float32Array(e*4);for(let y=0;y<e;y++)p[y*2]=i()*n,p[y*2+1]=i()*n,g[y*4]=i()*Math.PI*2,g[y*4+1]=.75+i()*.5,g[y*4+2]=i(),g[y*4+3]=i();v.setAttribute("aOffset",new qo(p,2)),v.setAttribute("aRand",new qo(g,4)),v.instanceCount=e;const x=new de({vertexColors:!0,side:cn,roughness:.88,metalness:0}),_={uHeightTex:{value:t.heightTexture},uGridN:{value:t.nearN},uSpacing:{value:t.nearSpacing},uPatch:{value:n},uTime:ne.uTime,uWind:ne.uWind,uWindStrength:ne.uWindStrength,uCamPos:ne.uCamPos,uPushers:ne.uPushers,uSunDir:ne.uSunDir,uSunColor:ne.uSunColor};x.onBeforeCompile=y=>{Object.assign(y.uniforms,_),y.vertexShader=y.vertexShader.replace("#include <common>",`#include <common>
uniform sampler2D uHeightTex; uniform float uGridN; uniform float uSpacing; uniform float uPatch;
uniform float uTime; uniform vec3 uWind; uniform float uWindStrength; uniform vec3 uCamPos; uniform vec4 uPushers[6];
attribute vec2 aOffset; attribute vec4 aRand;
varying float vGrassT; varying vec3 vGWPos;
${N0}
float gH(ivec2 g){ return texelFetch(uHeightTex, clamp(g, ivec2(0), ivec2(int(uGridN) - 1)), 0).r; }
vec3 gPlace; float gScale; mat2 gRot;
`).replace("#include <beginnormal_vertex>",`
vec2 cam2 = uCamPos.xz;
vec2 wp2 = aOffset + uPatch * floor((cam2 - aOffset) / uPatch + 0.5);
vec2 g = (wp2 + ${re.toFixed(1)}) / uSpacing;
ivec2 gi = ivec2(floor(g)); vec2 gf = fract(g);
float h = (gf.x + gf.y <= 1.0)
  ? gH(gi) + (gH(gi + ivec2(1, 0)) - gH(gi)) * gf.x + (gH(gi + ivec2(0, 1)) - gH(gi)) * gf.y
  : gH(gi + ivec2(1, 1)) + (gH(gi + ivec2(0, 1)) - gH(gi + ivec2(1, 1))) * (1.0 - gf.x) + (gH(gi + ivec2(1, 0)) - gH(gi + ivec2(1, 1))) * (1.0 - gf.y);
float dens = texelFetch(uHeightTex, clamp(ivec2(floor(g + 0.5)), ivec2(0), ivec2(int(uGridN) - 1)), 0).g;
float dist = length(wp2 - cam2);
float fade = 1.0 - smoothstep(uPatch * 0.3, uPatch * 0.5, dist);
float keep = step(aRand.w, dens * 1.15) * step(abs(wp2.x), ${(re-2).toFixed(1)}) * step(abs(wp2.y), ${(re-2).toFixed(1)});
gScale = aRand.y * keep * fade * (0.6 + 0.4 * dens);
gPlace = vec3(wp2.x, h - 0.03, wp2.y);
float cr = cos(aRand.x), sr = sin(aRand.x);
gRot = mat2(cr, -sr, sr, cr);
vec3 objectNormal = vec3(gRot * normal.xz, normal.y).xzy;
objectNormal = vec3(objectNormal.x, normal.y, objectNormal.z);
objectNormal = normalize(mix(normalize(objectNormal), vec3(0.0, 1.0, 0.0), 0.72));
#ifdef USE_TANGENT
vec3 objectTangent = vec3( tangent.xyz );
#endif
`).replace("#include <begin_vertex>",`
vec3 transformed = position;
transformed.xz = gRot * transformed.xz;
transformed *= gScale;
float t = uv.y;
vGrassT = t;
vec2 wdir = normalize(uWind.xz + 1e-4);
float gust = dNoise(gPlace.xz * 0.05 - wdir * uTime * 1.6);
float w = (gust * 1.3 + sin(uTime * 2.1 + gPlace.x * 0.35 + gPlace.z * 0.27) * 0.25) * uWindStrength;
transformed.xz += wdir * w * t * t * 0.28 * gScale;
transformed.y -= abs(w) * t * t * 0.06 * gScale;
for (int i = 0; i < 6; i++) {
  vec4 P = uPushers[i];
  vec2 d = gPlace.xz - P.xz;
  float dd = length(d);
  float k = (1.0 - smoothstep(P.w * 0.25, P.w, dd)) * step(abs(gPlace.y - P.y), 2.5);
  transformed.xz += normalize(d + 1e-4) * k * t * 0.4 * gScale;
  transformed.y -= k * t * 0.22 * gScale;
}
transformed += gPlace;
vGWPos = transformed;
`),y.fragmentShader=y.fragmentShader.replace("#include <common>",`#include <common>
uniform vec3 uSunDir; uniform vec3 uSunColor; varying float vGrassT; varying vec3 vGWPos;`).replace("#include <color_fragment>",`#include <color_fragment>
diffuseColor.rgb *= mix(0.55, 1.0, smoothstep(0.0, 0.5, vGrassT));`).replace("#include <emissivemap_fragment>",`#include <emissivemap_fragment>
{
  vec3 vd = normalize(vGWPos - cameraPosition);
  float back = pow(max(dot(vd, uSunDir), 0.0), 2.5);
  totalEmissiveRadiance += diffuseColor.rgb * uSunColor * back * vGrassT * 0.9;
}`)},x.customProgramCacheKey=()=>"grass-v1",this.mesh=new Ht(v,x),this.mesh.frustumCulled=!1,this.mesh.receiveShadow=!0,this.mesh.castShadow=!1}}function Qa(r,t,e,n,i,s){const o=new de({color:i,roughness:.93,vertexColors:!0});return o.onBeforeCompile=a=>{a.uniforms.tMap={value:t},a.uniforms.tNor={value:e},a.vertexShader=a.vertexShader.replace("#include <common>",`#include <common>
varying vec3 vMWPos; varying vec3 vMWN;`).replace("#include <project_vertex>",`#include <project_vertex>
vMWPos = (modelMatrix * vec4(transformed, 1.0)).xyz; vMWN = normalize(mat3(modelMatrix) * objectNormal);`),a.fragmentShader=a.fragmentShader.replace("#include <common>",`#include <common>
uniform sampler2D tMap; uniform sampler2D tNor; varying vec3 vMWPos; varying vec3 vMWN; vec3 mWN;`).replace("#include <map_fragment>",`{
  vec3 Nw = normalize(vMWN);
  vec3 bw = pow(abs(Nw), vec3(6.0)); bw /= (bw.x + bw.y + bw.z);
  vec3 p = vMWPos / ${n.toFixed(2)};
  vec3 c = texture2D(tMap, p.zy).rgb * bw.x + texture2D(tMap, p.xz).rgb * bw.y + texture2D(tMap, p.xy).rgb * bw.z;
  diffuseColor.rgb *= c;
  vec3 nx = texture2D(tNor, p.zy).xyz * 2.0 - 1.0, ny = texture2D(tNor, p.xz).xyz * 2.0 - 1.0, nz = texture2D(tNor, p.xy).xyz * 2.0 - 1.0;
  mWN = normalize(bw.x * normalize(vec3(0.0, nx.y, nx.x * sign(Nw.x)) + Nw) + bw.y * normalize(vec3(ny.x, 0.0, -ny.y) + Nw) + bw.z * normalize(vec3(nz.x * sign(Nw.z), nz.y, 0.0) + Nw));
}`).replace("#include <normal_fragment_maps>","normal = normalize((viewMatrix * vec4(mWN, 0.0)).xyz);")},o.customProgramCacheKey=()=>"masonry-"+s,o}function vo(r,t){const e=r.getAttribute("position").count,n=new Float32Array(e*3);for(let i=0;i<e;i++)n.set([t.r,t.g,t.b],i*3);return r.setAttribute("color",new te(n,3)),r.index?r.toNonIndexed():r}class yx{constructor(t,e,n){b(this,"group",new Ie);b(this,"smokeSources",[]);b(this,"gate",new A);b(this,"rachelPillar",new A);this.terrain=t,this.tex=e,this.colliders=n}build(){const t=Gn(1004),e=Xt.bethlehem,n=[],i=[],s=[],o=[];this.terrain.heightAt(e.x,e.z);const a=[],c=new dt,l=(P,B,G,Q,ut,X,Z,rt,J,ot)=>{const lt=new Vn(P,B,G);return lt.translate(Q,ut+B/2,X),lt.rotateY(Z),lt.translate(rt,0,J),vo(lt,ot)};for(let P=0;P<900&&a.length<58;P++){const B=t()*Math.PI*2,G=Math.sqrt(t())*(e.r-6),Q=e.x+Math.cos(B)*G,ut=e.z+Math.sin(B)*G,X=6+t()*5,Z=7+t()*5,rt=Math.round(t()*4)*(Math.PI/2)+(t()-.5)*.25+.3;let J=!0;for(const ot of a)Math.hypot(ot.x-Q,ot.z-ut)<(Math.max(X,Z)+Math.max(ot.w,ot.d))*.62&&(J=!1);J&&a.push({x:Q,z:ut,w:X,d:Z,rot:rt})}for(const P of a){const B=Math.min(this.terrain.heightAt(P.x-P.w/2,P.z-P.d/2),this.terrain.heightAt(P.x+P.w/2,P.z-P.d/2),this.terrain.heightAt(P.x-P.w/2,P.z+P.d/2),this.terrain.heightAt(P.x+P.w/2,P.z+P.d/2))-.4,Q=((t()<.22?2:1)===2?5.2:2.9)+t()*.4;c.setHSL(.09+t()*.02,.18+t()*.1,.72+t()*.12),n.push(l(P.w,Q,P.d,0,B,0,P.rot,P.x,P.z,c));const ut=c.clone().multiplyScalar(.95);n.push(l(P.w+.1,.45,.25,0,B+Q,P.d/2-.12,P.rot,P.x,P.z,ut)),n.push(l(P.w+.1,.45,.25,0,B+Q,-P.d/2+.12,P.rot,P.x,P.z,ut));const X=new dt().setHSL(.07,.25,.42+t()*.1);i.push(l(P.w+.35,.22,P.d+.35,0,B+Q-.05,0,P.rot,P.x,P.z,X));const Z=new dt(1709072);s.push(l(1.1,1.9,.12,(t()-.5)*P.w*.4,B+.3,P.d/2+.02,P.rot,P.x,P.z,Z));for(let J=0;J<2;J++)s.push(l(.45,.4,.1,(J-.5)*P.w*.5,B+Q-1,-P.d/2-.03,P.rot,P.x,P.z,Z));if(t()<.55){const J=4+t()*3,ot=c.clone().multiplyScalar(.9);n.push(l(.5,1.6,J,P.w/2-.25,B,P.d/2+J/2,P.rot,P.x,P.z,ot)),n.push(l(.5,1.6,J,-P.w/2+.25,B,P.d/2+J/2,P.rot,P.x,P.z,ot)),n.push(l(P.w*.35,1.6,.5,P.w*.32,B,P.d/2+J,P.rot,P.x,P.z,ot))}if(t()<.35){const J=new vi(2.4+t()*1.5,1.6+t());J.rotateX(-Math.PI/2+.25),J.translate(0,B+Q+1.3,0),J.rotateY(P.rot),J.translate(P.x,0,P.z);const ot=[new dt(9318179),new dt(3030891),new dt(14273712),new dt(10511914)];o.push(vo(J,ot[Math.floor(t()*ot.length)]));const lt=l(.08,1.5,.08,.9,B+Q,.6,P.rot,P.x,P.z,new dt(4864554));i.push(lt)}t()<.12&&this.smokeSources.push(new A(P.x,B+Q+.3,P.z));const rt=3;for(let J=0;J<rt;J++){const ot=(J/(rt-1)-.5)*(Math.max(P.w,P.d)-Math.min(P.w,P.d)),lt=P.w>P.d?new A(ot,0,0):new A(0,0,ot);lt.applyAxisAngle(new A(0,1,0),P.rot),this.colliders.add({x:P.x+lt.x,z:P.z+lt.z,r:Math.min(P.w,P.d)*.55,tag:"house"})}}const h=Math.atan2(Xt.path[Xt.path.length-1][1]-e.z,Xt.path[Xt.path.length-1][0]-e.x);this.gate.set(e.x+Math.cos(h)*(e.r+2),0,e.z+Math.sin(h)*(e.r+2)),this.gate.y=this.terrain.heightAt(this.gate.x,this.gate.z);const d=64;for(let P=0;P<d;P++){const B=P/d*Math.PI*2,G=(P+1)/d*Math.PI*2,Q=(B+G)/2;let ut=Math.abs(Q-h);if(ut=Math.min(ut,Math.PI*2-ut),ut<.07)continue;const X=e.r+2+Math.sin(P*1.7)*1.2,Z=e.x+Math.cos(B)*X,rt=e.z+Math.sin(B)*X,J=e.x+Math.cos(G)*X,ot=e.z+Math.sin(G)*X,lt=Math.hypot(J-Z,ot-rt),bt=(Z+J)/2,At=(rt+ot)/2,st=this.terrain.heightAt(bt,At)-.8,F=new Vn(lt+.3,3.4,1.4);F.translate(0,st+1.7,0),F.rotateY(-Math.atan2(ot-rt,J-Z)),F.translate(bt,0,At),c.setHSL(.09,.14,.66+Math.sin(P*3.1)*.04),n.push(vo(F,c)),this.colliders.add({x:bt,z:At,r:lt*.55,tag:"wall"})}for(const P of[-1,1]){const B=h+P*.095,G=e.x+Math.cos(B)*(e.r+2),Q=e.z+Math.sin(B)*(e.r+2),ut=this.terrain.heightAt(G,Q)-.8;n.push(l(3.2,5.2,3.2,0,ut,0,-B,G,Q,new dt().setHSL(.09,.14,.7)))}const f=Qa(this.tex,this.tex.wall,this.tex.wallN,2.4,15918802,"wall"),u=Qa(this.tex,this.tex.soil,this.tex.soilN,3,13154468,"roof"),m=new Ht(kn(n.map(P=>P.index?P.toNonIndexed():P)),f),v=new Ht(kn(i.map(P=>P.index?P.toNonIndexed():P)),u),p=new Ht(kn(s),new de({vertexColors:!0,roughness:1}));for(const P of[m,v,p])P.castShadow=!0,P.receiveShadow=!0,this.group.add(P);if(o.length){const P=new Ht(kn(o),new de({vertexColors:!0,roughness:.9,side:cn}));P.castShadow=!0,this.group.add(P)}const g=this.gate.x+Math.cos(h)*9+4,x=this.gate.z+Math.sin(h)*9-3,_=this.terrain.heightAt(g,x),y=new Ht(vo(new ia(1.1,1.25,.8,18,1,!0),new dt(1,1,1)),Qa(this.tex,this.tex.wall,this.tex.wallN,1.2,15260872,"well"));y.position.set(g,_+.3,x),y.castShadow=!0;const w=new Ht(new Yo(1.05,18),new ea({color:657414}));w.rotation.x=-Math.PI/2,w.position.set(g,_+.55,x),this.group.add(y,w),this.colliders.add({x:g,z:x,r:1.4,tag:"well"});const T=Xt.rachel,R=this.terrain.heightAt(T.x,T.z);this.rachelPillar.set(T.x,R,T.z);const E=zl(this.tex,15788250),D=new Vn(.62,2.7,.4,4,12,3);{const P=D.getAttribute("position");for(let B=0;B<P.count;B++){const G=P.getX(B),Q=P.getY(B),ut=P.getZ(B),X=1-(Q+1.35)*.06,Z=Math.sin(Q*7.1+G*9)*.012+Math.sin(ut*13+Q*3)*.01;P.setXYZ(B,G*X+Z,Q+(Q>1.3?Math.sin(G*5)*.06:0),ut*X+Z)}D.computeVertexNormals()}const M=new Ht(D,E);M.position.set(T.x,R+1.2,T.z),M.rotation.set(.03,.6,-.02),M.castShadow=M.receiveShadow=!0,this.group.add(M);const S=new Ii(Ul(3,2),E,22),k=new Dt;for(let P=0;P<22;P++){const B=t()*Math.PI*2,G=.5+t()*1.4,Q=.25+t()*.35;k.compose(new A(T.x+Math.cos(B)*G,R+Q*.2+(G<1?.2:0),T.z+Math.sin(B)*G),new De().setFromEuler(new Ve(t(),t()*6,t())),new A(Q,Q,Q)),S.setMatrixAt(P,k)}S.castShadow=S.receiveShadow=!0,this.group.add(S),this.colliders.add({x:T.x,z:T.z,r:1.6,tag:"pillar"});const N=Xt.threshing,z=this.terrain.heightAt(N.x,N.z),H=new Yo(9,40);H.rotateX(-Math.PI/2);const L=new Ht(H,new de({color:11901556,roughness:1,polygonOffset:!0,polygonOffsetFactor:-2}));L.position.set(N.x,z+.06,N.z),L.receiveShadow=!0;const V=new Xe(2.2,20,10,0,Math.PI*2,0,Math.PI/2);V.scale(1,.55,1);const O=new Ht(V,new de({color:14203762,roughness:1}));O.position.set(N.x+3,z,N.z-2),O.castShadow=O.receiveShadow=!0,this.group.add(L,O)}}const Mx=""+new URL("rock_albedo-D8PLsjH2.jpg",import.meta.url).href,bx=""+new URL("rock_normal-D4czEm8-.jpg",import.meta.url).href,Sx=""+new URL("grass_albedo-kPUKQTiK.jpg",import.meta.url).href,wx=""+new URL("grass_normal-BBipxroJ.jpg",import.meta.url).href,Tx=""+new URL("soil_albedo-BXdixt-d.jpg",import.meta.url).href,Ex=""+new URL("soil_normal-D8hW3rFg.jpg",import.meta.url).href,Ax=""+new URL("wall_albedo-BlnbOZGm.jpg",import.meta.url).href,Rx=""+new URL("wall_normal-DRFXZF6f.jpg",import.meta.url).href,Cx=""+new URL("linen_albedo-CZ6UFzoh.jpg",import.meta.url).href,Px=""+new URL("linen_normal-NjuX3EyQ.jpg",import.meta.url).href,Lx=""+new URL("leather_albedo-DVtGR37p.jpg",import.meta.url).href,kx=""+new URL("leather_normal-BQO706dK.jpg",import.meta.url).href,Dx=""+new URL("bark_albedo-HvYn_ogn.jpg",import.meta.url).href,Ix=""+new URL("bark_normal-CgoR3aeH.jpg",import.meta.url).href,Nx=""+new URL("olive_leaves-CxwAj-Dj.webp",import.meta.url).href,Ux=""+new URL("oak_leaves-Ct-VHIG6.webp",import.meta.url).href,zx=""+new URL("shrub_leaves-BEZRrm_7.webp",import.meta.url).href;function Fx(r,t){const e=new D0,n=new kv(e),i=Math.min(8,r.capabilities.getMaxAnisotropy()),s=(a,c,l=!0)=>{const h=n.load(a);return h.colorSpace=c?Mn:ui,l&&(h.wrapS=h.wrapT=Fo),h.anisotropy=i,h},o={rock:s(Mx,!0),rockN:s(bx,!1),grass:s(Sx,!0),grassN:s(wx,!1),soil:s(Tx,!0),soilN:s(Ex,!1),wall:s(Ax,!0),wallN:s(Rx,!1),linen:s(Cx,!0),linenN:s(Px,!1),leather:s(Lx,!0),leatherN:s(kx,!1),bark:s(Dx,!0),barkN:s(Ix,!1),olive:s(Nx,!0,!1),oak:s(Ux,!0,!1),shrub:s(zx,!0,!1)};return new Promise((a,c)=>{e.onProgress=(l,h,d)=>t(h/d),e.onLoad=()=>a(o),e.onError=l=>c(new Error("Failed to load texture "+l))})}const Zo=["desktop-high","desktop-medium","mobile-high","mobile-low"],es={"desktop-high":{maxPixelRatio:2,maxPixels:37e5,msaa:4,aa:"none",shadowSize:4096,bloom:!0,bloomScale:.5,bloomMips:6,godRaySamples:40,sharpen:.2,filmFx:!0,frameBudgetMs:18},"desktop-medium":{maxPixelRatio:1.5,maxPixels:21e5,msaa:2,aa:"none",shadowSize:2048,bloom:!0,bloomScale:.5,bloomMips:5,godRaySamples:28,sharpen:.25,filmFx:!0,frameBudgetMs:24},"mobile-high":{maxPixelRatio:2,maxPixels:17e5,msaa:0,aa:"fxaa",shadowSize:2048,bloom:!0,bloomScale:.5,bloomMips:5,godRaySamples:20,sharpen:.35,filmFx:!1,frameBudgetMs:30},"mobile-low":{maxPixelRatio:1.5,maxPixels:9e5,msaa:0,aa:"fxaa",shadowSize:1024,bloom:!0,bloomScale:.25,bloomMips:4,godRaySamples:12,sharpen:.4,filmFx:!1,frameBudgetMs:38}},Bx={"desktop-high":{name:"high",nearSpacing:1.6,farSegments:300,grassCount:46e3,grassPatch:54,treeScale:1,shrubs:4200,farTrees:9e3,rocks:3600,motes:700,particles:1800,texMax:4096,anisotropy:8},"desktop-medium":{name:"medium",nearSpacing:2,farSegments:240,grassCount:28e3,grassPatch:44,treeScale:.8,shrubs:2600,farTrees:6e3,rocks:2400,motes:450,particles:1500,texMax:2048,anisotropy:8},"mobile-high":{name:"low",nearSpacing:2.4,farSegments:200,grassCount:15e3,grassPatch:36,treeScale:.65,shrubs:1600,farTrees:4e3,rocks:1600,motes:300,particles:1200,texMax:2048,anisotropy:4},"mobile-low":{name:"low",nearSpacing:2.6,farSegments:180,grassCount:9e3,grassPatch:30,treeScale:.5,shrubs:1e3,farTrees:2600,rocks:1e3,motes:180,particles:900,texMax:1024,anisotropy:4}},F0="david.gpuTier.v2";function Ox(r){try{const t=JSON.parse(localStorage.getItem(F0)||"null");return!t||!Zo.includes(t.tier)||t.gpu!==r||Date.now()-t.when>21*864e5?null:t}catch{return null}}function bu(r){try{localStorage.setItem(F0,JSON.stringify(r))}catch{}}function Hx(){const r=navigator.userAgent;if(/Android|iPhone|iPad|iPod|Mobile|Silk|Kindle/i.test(r)||/Macintosh/.test(r)&&navigator.maxTouchPoints>1)return!0;try{if(matchMedia("(pointer: coarse)").matches&&!matchMedia("(any-pointer: fine)").matches&&Math.min(screen.width,screen.height)<900)return!0}catch{}return!1}function Vx(r){if(!r)return"";try{const t=r.getExtension("WEBGL_debug_renderer_info");return String(r.getParameter(t?t.UNMASKED_RENDERER_WEBGL:r.RENDERER)||"")}catch{return""}}function sl(r){return/SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(r)}function Gx(r,t){if(!r)return sl(t)?"desktop-high":/Intel.*(HD Graphics|UHD Graphics 6\d\d)|GMA|Mali|Adreno|PowerVR|Apple GPU/i.test(t)?"desktop-medium":"desktop-high";const e=navigator.deviceMemory;if(e!==void 0&&e<=3)return"mobile-low";if(sl(t)||/Apple/i.test(t))return"mobile-high";const n=/Adreno\D*(\d{3})/i.exec(t);return n?+n[1]>=640?"mobile-high":"mobile-low":/Mali-G(7[6-9]|\d{3})|Immortalis|Xclipse|Maleoon/i.test(t)?"mobile-high":"mobile-low"}function Wx(r,t){return r?Zo.includes(r)?r:r==="high"?"desktop-high":r==="medium"?"desktop-medium":r==="low"?"mobile-low":null:null}function tc(r,t,e,n=1){return{...es[r],...Bx[r],tier:r,mobile:t,gpu:e,renderScale:n,pixelRatio:1}}function qx(r=null){const t=new URLSearchParams(location.search),e=Hx(),n=Vx(r),i=Wx(t.get("q"),e),s=i?null:Ox(n),o=i?{...tc(i,e,n),forced:!0}:s?{...tc(s.tier,e,n,s.scale),forced:!1}:{...tc(Gx(e,n),e,n),forced:!1},a=f=>t.has(f)&&Number.isFinite(Number(t.get(f)))?Number(t.get(f)):null,c=a("pr"),l=a("sharpen"),h=a("msaa");c!==null&&(o.maxPixelRatio=c,o.maxPixels=1e9,o.forced=!0),l!==null&&(o.sharpen=Math.max(0,Math.min(1,l))),h!==null&&(o.msaa=h);const d=t.get("aa");return(d==="fxaa"||d==="none")&&(o.aa=d),o}class Xx{constructor(t){b(this,"renderer");b(this,"scene",new T0);b(this,"camera");b(this,"colliders",new Bv);b(this,"quality");b(this,"qualityForced");b(this,"tex");b(this,"terrain");b(this,"sky");b(this,"post");b(this,"vegetation");b(this,"rocks");b(this,"grass");b(this,"village");b(this,"particles");b(this,"motes");b(this,"smoke");b(this,"dynamic",new Ie);b(this,"focus",new A);b(this,"timeScale",1);b(this,"contextLost",!1);b(this,"onContextLost",null);b(this,"onContextRestored",null);b(this,"floatTargets");b(this,"gradeUniforms",U0());b(this,"restoreHooks",[]);b(this,"container");b(this,"cssW",0);b(this,"cssH",0);b(this,"resizePending",!1);b(this,"resizeRequestedAt",0);b(this,"syncPx",new Uint8Array(4));b(this,"gov",{acc:0,n:0,strikes:0,level:0});var c;this.container=t,this.renderer=new rv({antialias:!1,depth:!1,stencil:!1,alpha:!1,powerPreference:"high-performance",preserveDrawingBuffer:!1});const e=this.renderer.getContext(),n=qx(e);this.qualityForced=n.forced;const{forced:i,...s}=n;this.quality=s;const o=this.renderer.extensions;this.floatTargets=o.has("EXT_color_buffer_float")||o.has("EXT_color_buffer_half_float"),this.floatTargets||console.warn("[engine] float render targets unsupported: falling back to 8-bit HDR buffers"),this.renderer.shadowMap.enabled=!0,this.renderer.shadowMap.type=Wu,this.renderer.toneMapping=Yu,this.renderer.toneMappingExposure=.58,this.renderer.outputColorSpace=Mn;const a=this.renderer.domElement;a.style.cssText="display:block;position:absolute;left:0;top:0;width:100%;height:100%;touch-action:none;outline:none",(c=t.style).position||(c.position="relative"),t.appendChild(a),this.camera=new Cn(50,1,.3,26e3),this.scene.add(this.dynamic),this.applySize(!0),a.addEventListener("webglcontextlost",l=>{l.preventDefault(),this.contextLost=!0,console.warn("[engine] WebGL context lost"),this.onContextLost?.()}),a.addEventListener("webglcontextrestored",()=>{this.contextLost=!1,console.warn("[engine] WebGL context restored");try{this.sky?.capture(this.scene);for(const l of this.restoreHooks)l()}catch(l){console.error("[engine] restore failed",l)}this.onContextRestored?.()})}onRestore(t){this.restoreHooks.push(t)}async build(t){const e=this.quality,n=()=>new Promise(s=>requestAnimationFrame(()=>s()));t(.02,"טוען מרקמים…"),this.tex=await Fx(this.renderer,s=>t(.02+s*.2,"טוען מרקמים…")),t(.25,"מעצב את הרי יהודה…"),await n(),this.terrain=new hx({nearSpacing:e.nearSpacing,farSegments:e.farSegments}),t(.45,"מדליק את השמש…"),await n(),this.sky=new ax(this.renderer,e.shadowSize),this.scene.add(this.sky.group),this.sky.setSun(Ni.elevation,Ni.azimuth,this.scene),this.terrain.build(this.tex,ne.uSunDir.value),this.scene.add(this.terrain.group),t(.6,"בונה את בית לחם…"),await n(),this.village=new yx(this.terrain,this.tex,this.colliders),this.village.build(),this.scene.add(this.village.group),t(.7,"נוטע עצי זית…"),await n(),this.rocks=new xx(this.terrain,this.tex,this.colliders,e.rocks),this.rocks.build(),this.scene.add(this.rocks.group),this.vegetation=new vx(this.terrain,this.tex,this.colliders,{treeScale:e.treeScale,shrubs:e.shrubs,farTrees:e.farTrees}),this.vegetation.build(),this.scene.add(this.vegetation.group),t(.82,"מגדל עשב…"),await n(),this.grass=new _x(this.terrain,e.grassCount,e.grassPatch),this.scene.add(this.grass.mesh),this.particles=new sx(e.particles),this.scene.add(this.particles.points),this.motes=new rx(e.motes),this.scene.add(this.motes.points),this.smoke=new ox(this.particles,this.village.smokeSources),this.makePost(),this.applySize(!0);const i=()=>this.requestResize();addEventListener("resize",i),addEventListener("orientationchange",i);try{new ResizeObserver(i).observe(this.container)}catch{}t(.95,"מכין את הצאן…"),await n()}viewSize(){const t=this.container.clientWidth||innerWidth||1,e=this.container.clientHeight||innerHeight||1;return{w:Math.max(1,Math.round(t)),h:Math.max(1,Math.round(e))}}computePixelRatio(t,e){const n=this.quality,i=window.devicePixelRatio||1;let s=Math.min(i,n.maxPixelRatio);const o=n.maxPixels*n.renderScale;t*e*s*s>o&&(s=Math.sqrt(o/(t*e)));const a=this.renderer.capabilities.maxTextureSize||4096;return s=Math.min(s,a/t,a/e),Math.max(.5,Math.floor(s*64)/64)}requestResize(){this.resizePending=!0,this.resizeRequestedAt=performance.now()}resize(){this.applySize(!0)}applySize(t=!1){const{w:e,h:n}=this.viewSize(),i=this.computePixelRatio(e,n);if(!t&&e===this.cssW&&n===this.cssH&&i===this.quality.pixelRatio)return;this.cssW=e,this.cssH=n,this.quality.pixelRatio=i,this.renderer.setPixelRatio(i),this.renderer.setSize(e,n,!1),this.camera.aspect=e/n,this.camera.updateProjectionMatrix();const s=Math.floor(e*i),o=Math.floor(n*i);this.post?.setSize(s,o),this.particles?.setPixelScale(n*i,this.camera.fov),this.motes?.setPixelScale(n*i,this.camera.fov)}flushResize(){this.resizePending&&(performance.now()-this.resizeRequestedAt<150||(this.resizePending=!1,this.applySize(!1)))}setFov(t){if(Math.abs(this.camera.fov-t)<.01)return;this.camera.fov=t,this.camera.updateProjectionMatrix();const e=this.renderer.getPixelRatio();this.particles.setPixelScale(this.cssH*e,t),this.motes.setPixelScale(this.cssH*e,t)}makePost(){const t=this.quality;this.post?.dispose(),this.post=new ix(this.renderer,this.scene,this.camera,this.sky.cubeTarget.texture,{msaa:t.msaa,bloom:t.bloom,godRaySamples:t.godRaySamples,pixelRatio:t.pixelRatio,aa:t.aa,sharpen:t.sharpen,filmFx:t.filmFx,bloomScale:t.bloomScale,bloomMips:t.bloomMips,colorType:this.floatTargets?xi:ti,gradeUniforms:this.gradeUniforms}),this.post.setSize(Math.floor(this.cssW*t.pixelRatio),Math.floor(this.cssH*t.pixelRatio));const e=new URLSearchParams(location.search).get("bloomfx");if(e&&this.post.bloom){const[n,i,s]=e.split(",").map(Number);Number.isFinite(n)&&(this.post.bloom.strength=n),Number.isFinite(i)&&(this.post.bloom.radius=i),Number.isFinite(s)&&(this.post.bloom.threshold=s)}}setShadowSize(t){const e=this.sky.sun;e.shadow.mapSize.x!==t&&(e.shadow.mapSize.set(t,t),e.shadow.map?.dispose(),e.shadow.map=null)}applyRenderTier(t,e=1){Object.assign(this.quality,es[t],{tier:t,renderScale:e}),this.setShadowSize(this.quality.shadowSize),this.applySize(!0),this.makePost()}renderStill(){ne.uCamPos.value.copy(this.camera.position),this.camera.updateMatrixWorld(),this.sky.update(this.camera,this.focus),this.post.render(0)}gpuSync(){const t=this.renderer.getContext();t.readPixels(0,0,1,1,t.RGBA,t.UNSIGNED_BYTE,this.syncPx)}async precompile(){const t=[];this.scene.traverse(n=>{n.visible||(t.push(n),n.visible=!0)});const e=this.renderer.getRenderTarget();try{this.renderer.setRenderTarget(this.post.composer.readBuffer),await Promise.race([this.renderer.compileAsync(this.scene,this.camera),new Promise(n=>setTimeout(n,12e3))])}catch(n){console.warn("[engine] precompile failed",n)}finally{for(const n of t)n.visible=!1;this.renderer.setRenderTarget(e)}}async warmup(t={}){const e=this.quality,n=this.camera,i=n.position.clone(),s=n.quaternion.clone();(t.precompile??!0)&&await this.precompile();const o=t.views?.length?t.views:[{pos:n.position.clone(),look:n.position.clone().add(n.getWorldDirection(new A))}],a=h=>{n.position.copy(h.pos),n.lookAt(h.look),n.updateMatrixWorld(),this.focus.copy(h.look)},c=(t.bench??!0)&&!this.qualityForced&&!sl(e.gpu)&&!this.contextLost;if(c||(t.precompile??!0)){for(const h of o)a(h),this.renderStill();this.gpuSync()}let l=null;if(c){const h=[],d=performance.now(),f=()=>{let g=0;for(const x of o){a(x),this.renderStill(),this.gpuSync();const _=[];for(let y=0;y<5;y++){const w=performance.now();this.renderStill(),this.gpuSync();const T=performance.now()-w;if(_.push(T),T>250||performance.now()-d>6e3)break}_.sort((y,w)=>y-w),g=Math.max(g,_[Math.floor(_.length/2)])}return g},u=Zo.filter(g=>e.mobile?g.startsWith("mobile"):!0);let m=e.tier,v=f();for(h.push(`${m}@${e.pixelRatio.toFixed(2)}: ${v.toFixed(1)}ms`);v>es[m].frameBudgetMs&&u.indexOf(m)<u.length-1&&performance.now()-d<6e3;)m=u[u.indexOf(m)+1],this.applyRenderTier(m),await this.precompile(),this.renderStill(),v=f(),h.push(`${m}@${e.pixelRatio.toFixed(2)}: ${v.toFixed(1)}ms`);let p=1;if(v>es[m].frameBudgetMs*1.15)p=Math.max(.55,Math.min(1,es[m].frameBudgetMs/v)),this.applyRenderTier(m,p),this.renderStill(),v=f(),h.push(`${m}x${p.toFixed(2)}@${e.pixelRatio.toFixed(2)}: ${v.toFixed(1)}ms`);else if(h.length===1){const g=u.indexOf(m),x=g>0?u[g-1]:null;if(x&&v<es[x].frameBudgetMs*.45){this.applyRenderTier(x),await this.precompile(),this.renderStill();const _=f();h.push(`${x}@${e.pixelRatio.toFixed(2)}: ${_.toFixed(1)}ms`),_<=es[x].frameBudgetMs*.9?(m=x,v=_):this.applyRenderTier(m)}}bu({tier:m,scale:p,ms:v,when:Date.now(),gpu:e.gpu}),l={tier:m,renderScale:p,ms:v,pixelRatio:e.pixelRatio,log:h},console.info("[engine] warm-up benchmark",h.join(" → "),`(${(performance.now()-d).toFixed(0)} ms)`)}return n.position.copy(i),n.quaternion.copy(s),n.updateMatrixWorld(),this.gov={acc:0,n:0,strikes:0,level:0},l}perfTick(t,e){const n=this.gov;if(!e||t>.5||this.contextLost||(n.acc+=t,n.n++,n.acc<4))return;const i=n.acc/n.n*1e3;if(n.acc=0,n.n=0,i>this.quality.frameBudgetMs*1.6?n.strikes++:n.strikes=Math.max(0,n.strikes-1),n.strikes<2||n.level>=2)return;n.strikes=0,n.level++;const s=this.quality;if(n.level===1?(s.godRaySamples=Math.max(6,Math.round(s.godRaySamples/2)),this.post.setGodRaySamples(s.godRaySamples),s.mobile&&(s.bloom=!1,this.post.setBloomEnabled(!1))):(s.shadowSize=Math.max(512,s.shadowSize/2),this.setShadowSize(s.shadowSize)),console.warn(`[engine] sustained ${i.toFixed(1)} ms frames: degraded render budget (level ${n.level})`),!this.qualityForced){const o=Zo.filter(c=>s.mobile?c.startsWith("mobile"):!0),a=o[Math.min(o.length-1,o.indexOf(s.tier)+1)];bu({tier:a,scale:s.renderScale,ms:i,when:Date.now(),gpu:s.gpu})}}get degradeLevel(){return this.gov.level}tickEnvironment(t){ne.uTime.value+=t,ne.uCamPos.value.copy(this.camera.position),this.particles.update(t),this.smoke.update(t)}render(t,e){ne.uTime.value+=e,ne.uCamPos.value.copy(this.camera.position),this.particles.update(e),this.smoke.update(e),!this.contextLost&&(this.flushResize(),this.sky.update(this.camera,this.focus),this.post.render(t))}}class jx{constructor(t,e=1){b(this,"frames",0);b(this,"sampled",0);b(this,"black",0);b(this,"blotches",0);b(this,"lastDark",0);b(this,"lastMean",0);b(this,"events",[]);b(this,"buf",new Uint8Array(4));b(this,"prevDark",-1);this.renderer=t,this.every=e}afterFrame(){if(this.frames++,this.every>1&&this.frames%this.every!==0)return!1;const t=this.renderer.getContext();if(t.isContextLost())return!1;const e=t.drawingBufferWidth,n=t.drawingBufferHeight;if(e<2||n<2)return!1;this.buf.length<e*4&&(this.buf=new Uint8Array(e*4));let i=0,s=0,o=0;for(const l of[.3,.55,.8]){t.readPixels(0,Math.floor(n*l),e,1,t.RGBA,t.UNSIGNED_BYTE,this.buf);for(let h=0;h<e;h+=2){const d=h*4,f=.2126*this.buf[d]+.7152*this.buf[d+1]+.0722*this.buf[d+2];o+=f,f<4&&s++,i++}}this.sampled++;const a=s/Math.max(1,i);this.lastDark=a,this.lastMean=o/Math.max(1,i);let c=!1;return a>.97?(this.black++,this.events.push({frame:this.frames,dark:a,mean:this.lastMean,kind:"black"}),c=!0):this.prevDark>=0&&a-this.prevDark>.2&&(this.blotches++,this.events.push({frame:this.frames,dark:a,mean:this.lastMean,kind:"blotch"}),c=!0),this.events.length>200&&this.events.splice(0,this.events.length-200),this.prevDark=a,c}stats(){return{frames:this.frames,sampled:this.sampled,black:this.black,blotches:this.blotches,lastDark:this.lastDark,lastMean:this.lastMean,events:this.events.slice(-20)}}}class Yx{constructor(t,e){b(this,"move",new ct);b(this,"lookDX",0);b(this,"lookDY",0);b(this,"sprint",!1);b(this,"slingHeld",!1);b(this,"interactHeld",!1);b(this,"isTouch");b(this,"enabled",!0);b(this,"keys",new Set);b(this,"pressed",new Set);b(this,"released",new Set);b(this,"touchMove",new ct);b(this,"touchSprint",!1);b(this,"joyId",null);b(this,"joyOrigin",new ct);b(this,"lookId",null);b(this,"lookLast",new ct);b(this,"joyEl");b(this,"joyKnob");b(this,"wheel",0);b(this,"lockFailed",!1);this.canvas=t,this.uiRoot=e,this.isTouch=matchMedia("(pointer: coarse)").matches||"ontouchstart"in window,addEventListener("keydown",n=>this.onKey(n,!0)),addEventListener("keyup",n=>this.onKey(n,!1)),addEventListener("blur",()=>{this.keys.clear(),this.slingHeld=!1}),t.addEventListener("mousedown",n=>{if(this.enabled){if(document.pointerLockElement!==t&&!this.isTouch&&!this.lockFailed)try{const i=t.requestPointerLock?.();i&&typeof i.catch=="function"&&i.catch(()=>this.lockFailed=!0)}catch{this.lockFailed=!0}n.button===0&&(this.slingHeld=!0,this.pressed.add("sling")),n.button===2&&this.pointerLocked&&this.pressed.add("strike")}}),document.addEventListener("pointerlockerror",()=>this.lockFailed=!0),addEventListener("mouseup",n=>{n.button===0&&this.slingHeld&&(this.slingHeld=!1,this.released.add("sling"))}),t.addEventListener("contextmenu",n=>n.preventDefault()),addEventListener("mousemove",n=>{document.pointerLockElement===t?(this.lookDX+=n.movementX,this.lookDY+=n.movementY):n.buttons&3&&(this.lookDX+=n.movementX*1.4,this.lookDY+=n.movementY*1.4)}),t.addEventListener("wheel",n=>{this.wheel+=Math.sign(n.deltaY)},{passive:!0}),this.isTouch&&this.buildTouch()}get pointerLocked(){return document.pointerLockElement===this.canvas}onKey(t,e){const n=t.code;e&&!this.keys.has(n)&&(n==="KeyE"&&(this.pressed.add("interact"),this.interactHeld=!0),n==="KeyQ"&&this.pressed.add("call"),n==="Space"&&this.pressed.add("dodge"),n==="KeyF"&&this.pressed.add("strike"),n==="Enter"&&this.pressed.add("skip"),(n==="Escape"||n==="KeyP")&&this.pressed.add("pause")),!e&&n==="KeyE"&&(this.interactHeld=!1),e?this.keys.add(n):this.keys.delete(n),["Space","ArrowUp","ArrowDown","ArrowLeft","ArrowRight"].includes(n)&&t.preventDefault()}take(t){const e=this.pressed.has(t);return this.pressed.delete(t),e}takeRelease(t){const e=this.released.has(t);return this.released.delete(t),e}press(t){this.pressed.add(t)}update(){let t=0,e=0;(this.keys.has("KeyW")||this.keys.has("ArrowUp"))&&(e+=1),(this.keys.has("KeyS")||this.keys.has("ArrowDown"))&&(e-=1),(this.keys.has("KeyD")||this.keys.has("ArrowRight"))&&(t+=1),(this.keys.has("KeyA")||this.keys.has("ArrowLeft"))&&(t-=1),this.move.set(t,e),this.move.lengthSq()>1&&this.move.normalize(),this.touchMove.lengthSq()>1e-4&&this.move.copy(this.touchMove),this.sprint=this.keys.has("ShiftLeft")||this.keys.has("ShiftRight")||this.touchSprint,this.enabled||this.move.set(0,0)}consumeLook(){const t=new ct(this.lookDX,this.lookDY);return this.lookDX=this.lookDY=0,t}clearEdges(){this.pressed.clear(),this.released.clear()}buildTouch(){const t=document.createElement("div");t.className="touch-layer",t.innerHTML=`
      <div class="joy"><div class="joy-knob"></div></div>
      <div class="tbtns">
        <button class="tbtn big" data-a="sling">קֶלַע</button>
        <button class="tbtn" data-a="strike">מַקֵּל</button>
        <button class="tbtn" data-a="interact">פְּעֻלָּה</button>
        <button class="tbtn" data-a="dodge">הִתְחַמֵּק</button>
        <button class="tbtn small" data-a="call">קְרִיאָה</button>
      </div>`,this.uiRoot.appendChild(t),this.joyEl=t.querySelector(".joy"),this.joyKnob=t.querySelector(".joy-knob"),t.querySelectorAll(".tbtn").forEach(s=>{const o=s.dataset.a;s.addEventListener("touchstart",c=>{c.preventDefault(),c.stopPropagation(),s.classList.add("on"),o==="sling"&&(this.slingHeld=!0),o==="interact"&&(this.interactHeld=!0),this.pressed.add(o)},{passive:!1});const a=c=>{c.preventDefault(),s.classList.remove("on"),o==="sling"&&this.slingHeld&&(this.slingHeld=!1,this.released.add("sling")),o==="interact"&&(this.interactHeld=!1)};s.addEventListener("touchend",a,{passive:!1}),s.addEventListener("touchcancel",a,{passive:!1})});const e=s=>{for(const o of Array.from(s.changedTouches))o.clientX<innerWidth*.42&&this.joyId===null?(this.joyId=o.identifier,this.joyOrigin.set(o.clientX,o.clientY),this.joyEl.style.left=o.clientX-60+"px",this.joyEl.style.top=o.clientY-60+"px",this.joyEl.classList.add("on")):this.lookId===null&&(this.lookId=o.identifier,this.lookLast.set(o.clientX,o.clientY))},n=s=>{for(const o of Array.from(s.changedTouches))if(o.identifier===this.joyId){const a=o.clientX-this.joyOrigin.x,c=o.clientY-this.joyOrigin.y,l=Math.hypot(a,c),h=55,d=Math.min(1,l/h);this.touchMove.set(a/(l||1),-c/(l||1)).multiplyScalar(d),this.touchSprint=l>h*1.35;const f=Math.min(l,h);this.joyKnob.style.transform=`translate(${a/(l||1)*f}px, ${c/(l||1)*f}px)`}else o.identifier===this.lookId&&(this.lookDX+=(o.clientX-this.lookLast.x)*1.6,this.lookDY+=(o.clientY-this.lookLast.y)*1.6,this.lookLast.set(o.clientX,o.clientY));s.preventDefault()},i=s=>{for(const o of Array.from(s.changedTouches))o.identifier===this.joyId&&(this.joyId=null,this.touchMove.set(0,0),this.touchSprint=!1,this.joyKnob.style.transform="",this.joyEl.classList.remove("on")),o.identifier===this.lookId&&(this.lookId=null)};this.canvas.addEventListener("touchstart",e,{passive:!0}),this.canvas.addEventListener("touchmove",n,{passive:!1}),this.canvas.addEventListener("touchend",i),this.canvas.addEventListener("touchcancel",i)}setTouchVisible(t){const e=this.uiRoot.querySelector(".touch-layer");e&&(e.style.display=t?"":"none")}}const $x=" … ",ra={s1_17_12_ephrathite:{id:"s1_17_12_ephrathite",kind:"tanakh",ref:"שְׁמוּאֵל א׳ יז, יב",refEn:"I Samuel 17:12",edition:"Miqra according to the Masorah",license:"CC-BY-SA",text:"וְדָוִד בֶּן־אִישׁ אֶפְרָתִי הַזֶּה מִבֵּית לֶחֶם יְהוּדָה וּשְׁמוֹ יִשַׁי וְלוֹ שְׁמֹנָה בָנִים וְהָאִישׁ בִּימֵי שָׁאוּל זָקֵן בָּא בַאֲנָשִׁים",quote:["וְדָוִד בֶּן־אִישׁ אֶפְרָתִי הַזֶּה מִבֵּית לֶחֶם יְהוּדָה וּשְׁמוֹ יִשַׁי"],status:"in-game",use:"Story.ts intro t=11.2 ui.verse",gloss:"Now David was the son of that Ephrathite of Bethlehem in Judah, whose name was Jesse.",crossCheck:"WLC identical"},gen_35_19_rachel_buried:{id:"gen_35_19_rachel_buried",kind:"tanakh",ref:"בְּרֵאשִׁית לה, יט",refEn:"Genesis 35:19",edition:"Miqra according to the Masorah",license:"CC-BY-SA",text:"וַתָּמָת רָחֵל וַתִּקָּבֵר בְּדֶרֶךְ אֶפְרָתָה הִוא בֵּית לָחֶם",quote:["וַתִּקָּבֵר בְּדֶרֶךְ אֶפְרָתָה הִוא בֵּית לָחֶם"],status:"in-game",use:"Story.ts intro t=16.2 ui.caption sub (Rachel's tomb)",gloss:"...and was buried on the way to Ephrath, which is Bethlehem.",note:"בֵּית לָחֶם with qamats is the pausal form at the end of the verse - correct as printed.",crossCheck:"WLC identical"},s1_16_11_youngest:{id:"s1_16_11_youngest",kind:"tanakh",ref:"שְׁמוּאֵל א׳ טז, יא",refEn:"I Samuel 16:11",edition:"Miqra according to the Masorah",license:"CC-BY-SA",text:"וַיֹּאמֶר שְׁמוּאֵל אֶל־יִשַׁי הֲתַמּוּ הַנְּעָרִים וַיֹּאמֶר עוֹד שָׁאַר הַקָּטָן וְהִנֵּה רֹעֶה בַּצֹּאן וַיֹּאמֶר שְׁמוּאֵל אֶל־יִשַׁי שִׁלְחָה וְקָחֶנּוּ כִּי לֹא־נָסֹב עַד־בֹּאוֹ פֹה",quote:["עוֹד שָׁאַר הַקָּטָן וְהִנֵּה רֹעֶה בַּצֹּאן"],status:"in-game",use:"Story.ts intro t=22.8 ui.verse",gloss:"There remains yet the youngest, and behold, he is tending the sheep.",note:"Spoken by Jesse to Samuel on the day of the anointing (16:11). Shown in the intro as a description of David; the reference makes the source clear.",crossCheck:"WLC identical"},s1_16_12_ruddy:{id:"s1_16_12_ruddy",kind:"tanakh",ref:"שְׁמוּאֵל א׳ טז, יב",refEn:"I Samuel 16:12",edition:"Miqra according to the Masorah",license:"CC-BY-SA",text:"וַיִּשְׁלַח וַיְבִיאֵהוּ וְהוּא אַדְמוֹנִי עִם־יְפֵה עֵינַיִם וְטוֹב רֹאִי וַיֹּאמֶר ה׳ קוּם מְשָׁחֵהוּ כִּי־זֶה הוּא",quote:["וְהוּא אַדְמוֹנִי עִם־יְפֵה עֵינַיִם וְטוֹב רֹאִי"],status:"in-game",use:"Story.ts intro t=29.5 ui.verse",gloss:"And he was ruddy, with beautiful eyes and good looks.",crossCheck:"WLC identical"},shr_2_2_flock:{id:"shr_2_2_flock",kind:"midrash",ref:"שְׁמוֹת רַבָּה ב, ב",refEn:"Shemot Rabbah 2:2",edition:"Midrash Rabbah -- TE",license:"unknown",text:"וּמשֶׁה הָיָה רֹעֶה, הֲדָא הוּא דִכְתִיב: וַה' בְּהֵיכַל קָדְשׁוֹ, אָמַר רַבִּי שְׁמוּאֵל בַּר נַחְמָן עַד שֶׁלֹא חָרַב בֵּית הַמִּקְדָּשׁ הָיְתָה שְׁכִינָה שׁוֹרָה בְּתוֹכוֹ, שֶׁנֶּאֱמַר: ה' בְּהֵיכַל קָדְשׁוֹ, וּמִשֶּׁחָרַב בֵּית הַמִּקְדָּשׁ נִסְתַּלְּקָה הַשְּׁכִינָה לַשָּׁמַיִם, שֶׁנֶּאֱמַר: ה' בַּשָּׁמַיִם הֵכִין כִּסְאוֹ. רַבִּי אֶלְעָזָר אוֹמֵר לֹא זָזָה הַשְּׁכִינָה מִתּוֹךְ הַהֵיכָל, שֶׁנֶּאֱמַר: וְהָיוּ עֵינַי וְלִבִּי שָׁם וגו'. וְכֵן הוּא אוֹמֵר: קוֹלִי אֶל ה' אֶקְרָא וַיַּעֲנֵנִי מֵהַר קָדְשׁוֹ סֶלָּה, אַף עַל פִּי שֶׁהוּא חָרֵב הֲרֵי הוּא בִּקְדֻשָּׁתוֹ, בּוֹא וּרְאֵה מַה כּוֹרֶשׁ אוֹמֵר: הוּא הָאֱלֹהִים אֲשֶׁר בִּיְרוּשָׁלָיִם, אָמַר לָהֶן אַף עַל פִּי שֶׁהוּא חָרֵב הָאֱלֹהִים אֵינוֹ זָז מִשָּׁם. אָמַר רַב אַחָא, לְעוֹלָם אֵין הַשְּׁכִינָה זָזָה מִכֹּתֶל מַעֲרָבִי, שֶׁנֶּאֱמַר: הִנֵּה זֶה עוֹמֵד אַחַר כָּתְלֵנוּ, וּכְתִיב: עֵינָיו יֶחֱזוּ עַפְעַפָּיו יִבְחֲנוּ בְּנֵי אָדָם, אָמַר רַבִּי יַנַּאי אַף עַל פִּי שֶׁשְּׁכִינָתוֹ בַּשָּׁמַיִם עֵינָיו יֶחֱזוּ עַפְעַפָּיו יִבְחֲנוּ בְּנֵי אָדָם, מָשָׁל לְמֶלֶךְ שֶׁהָיָה לוֹ פַּרְדֵּס וּבָנָה בוֹ מִגְדָּל גָּבוֹהַּ וְצִוָּה הַמֶּלֶךְ שֶׁיִּתְּנוּ לְתוֹכוֹ פּוֹעֲלִים שֶׁיִּהְיוּ עוֹסְקִים בִּמְלַאכְתּוֹ, אָמַר הַמֶּלֶךְ כָּל מִי שֶׁמִּתְכַּשֵּׁר בִּמְלַאכְתּוֹ יִטֹּל שְׂכָרוֹ מִשָּׁלֵם, וְכָל מִי שֶׁמִּתְעַצֵּל בִּמְלַאכְתּוֹ יִנָּתֵן בְּדִימוֹס. הַמֶּלֶךְ, זֶה מַלְכֵי הַמְּלָכִים, וְהַפַּרְדֵּס, זֶה הָעוֹלָם שֶׁנָּתַן הַקָּדוֹשׁ בָּרוּךְ הוּא לְיִשְׂרָאֵל בְּתוֹכוֹ לִשְׁמֹר הַתּוֹרָה, וְהִתְנָה עִמָּהֶם וְאָמַר, מִי שֶׁהוּא שׁוֹמֵר אֶת הַתּוֹרָה הֲרֵי גַּן עֵדֶן לְפָנָיו, וּמִי שֶׁאֵינוֹ מְשַׁמְּרָהּ, הֲרֵי גֵּיהִנֹּם. אַף הַקָּדוֹשׁ בָּרוּךְ הוּא אַף עַל פִּי שֶׁהוּא נִרְאֶה כִּמְסַלֵּק שְׁכִינָתוֹ מִבֵּית הַמִּקְדָּשׁ, עֵינָיו יֶחֱזוּ עַפְעַפָּיו יִבְחֲנוּ בְּנֵי אָדָם, וּלְמִי בּוֹחֵן, לַצַּדִּיק, שֶׁנֶּאֱמַר: ה' צַדִּיק יִבְחָן, [במה הוא בוחנו], בְּמִרְעֵה צֹאן. בָּדַק לְדָוִד בַּצֹּאן וּמְצָאוֹ רוֹעֶה יָפֶה, שֶׁנֶּאֱמַר: וַיִּקָּחֵהוּ מִמִּכְלְאֹת צֹאן, מַהוּ מִמִּכְלְאֹת צֹאן, כְּמוֹ: וַיִּכָּלֵא הַגֶּשֶׁם, הָיָה מוֹנֵעַ הַגְּדוֹלִים מִפְּנֵי הַקְּטַנִּים, וְהָיָה מוֹצִיא הַקְּטַנִּים לִרְעוֹת, כְּדֵי שֶׁיִּרְעוּ עֵשֶׂב הָרַךְ, וְאַחַר כָּךְ מוֹצִיא הַזְּקֵנִים כְּדֵי שֶׁיִּרְעוּ עֵשֶׂב הַבֵּינוֹנִית, וְאַחַר כָּךְ מוֹצִיא הַבַּחוּרִים שֶׁיִּהְיוּ אוֹכְלִין עֵשֶׂב הַקָּשֶׁה. אָמַר הַקָּדוֹשׁ בָּרוּךְ הוּא, מִי שֶׁהוּא יוֹדֵעַ לִרְעוֹת הַצֹּאן אִישׁ לְפִי כֹחוֹ, יָבֹא וְיִרְעֶה בְּעַמִּי. הֲדָא הוּא דִכְתִיב: מֵאַחַר עָלוֹת הֱבִיאוֹ לִרְעוֹת בְּיַעֲקֹב עַמּוֹ. וְאַף משֶׁה לֹא בְחָנוֹ הַקָּדוֹשׁ בָּרוּךְ הוּא אֶלָּא בַּצֹּאן, אָמְרוּ רַבּוֹתֵינוּ, כְּשֶׁהָיָה משֶׁה רַבֵּינוּ עָלָיו הַשָּׁלוֹם רוֹעֶה צֹאנוֹ שֶׁל יִתְרוֹ בַּמִּדְבָּר, בָּרַח מִמֶּנּוּ גְּדִי, וְרָץ אַחֲרָיו עַד שֶׁהִגִּיעַ לַחֲסִית, כֵּיוָן שֶׁהִגִּיעַ לַחֲסִית, נִזְדַּמְּנָה לוֹ בְּרֵכָה שֶׁל מַיִם, וְעָמַד הַגְּדִי לִשְׁתּוֹת, כֵּיוָן שֶׁהִגִּיעַ משֶׁה אֶצְלוֹ, אָמַר אֲנִי לֹא הָיִיתִי יוֹדֵעַ שֶׁרָץ הָיִיתָ מִפְּנֵי צָמָא, עָיֵף אַתָּה, הִרְכִּיבוֹ עַל כְּתֵפוֹ וְהָיָה מְהַלֵּךְ. אָמַר הַקָּדוֹשׁ בָּרוּךְ הוּא, יֵשׁ לְךָ רַחֲמִים לִנְהֹג צֹאנוֹ שֶׁל בָּשָׂר וָדָם כָּךְ חַיֶּיךָ אַתָּה תִרְעֶה צֹאנִי יִשְׂרָאֵל, הֱוֵי: וּמשֶׁה הָיָה רוֹעֶה.",quote:["בָּדַק לְדָוִד בַּצֹּאן וּמְצָאוֹ רוֹעֶה יָפֶה","הָיָה מוֹנֵעַ הַגְּדוֹלִים מִפְּנֵי הַקְּטַנִּים, וְהָיָה מוֹצִיא הַקְּטַנִּים לִרְעוֹת, כְּדֵי שֶׁיִּרְעוּ עֵשֶׂב הָרַךְ, וְאַחַר כָּךְ מוֹצִיא הַזְּקֵנִים כְּדֵי שֶׁיִּרְעוּ עֵשֶׂב הַבֵּינוֹנִית, וְאַחַר כָּךְ מוֹצִיא הַבַּחוּרִים שֶׁיִּהְיוּ אוֹכְלִין עֵשֶׂב הַקָּשֶׁה. אָמַר הַקָּדוֹשׁ בָּרוּךְ הוּא, מִי שֶׁהוּא יוֹדֵעַ לִרְעוֹת הַצֹּאן אִישׁ לְפִי כֹחוֹ, יָבֹא וְיִרְעֶה בְּעַמִּי"],status:"in-game",use:"Story.ts:226 ui.toast after calling the flock (replaces the paraphrase)",gloss:"He tested David with the sheep and found him a good shepherd... He would hold back the big ones for the sake of the small ones; he brought out the small ones to graze so they would eat the soft grass, then the old ones to eat the middling grass, then the young strong ones to eat the hard grass. Said the Holy One, blessed be He: whoever knows how to shepherd the flock, each according to its strength, let him come and shepherd My people.",note:"Vocalized text of the Torat Emet edition (as on Sefaria); consonantal text verified identical to the Daat edition (public domain). The midrash expounds Ps 78:70-71.",crossCheck:"Daat (public domain) consonantal text identical"},shr_2_2_flock_short:{id:"shr_2_2_flock_short",kind:"midrash",ref:"שְׁמוֹת רַבָּה ב, ב",refEn:"Shemot Rabbah 2:2",edition:"Midrash Rabbah -- TE",license:"unknown",text:"וּמשֶׁה הָיָה רֹעֶה, הֲדָא הוּא דִכְתִיב: וַה' בְּהֵיכַל קָדְשׁוֹ, אָמַר רַבִּי שְׁמוּאֵל בַּר נַחְמָן עַד שֶׁלֹא חָרַב בֵּית הַמִּקְדָּשׁ הָיְתָה שְׁכִינָה שׁוֹרָה בְּתוֹכוֹ, שֶׁנֶּאֱמַר: ה' בְּהֵיכַל קָדְשׁוֹ, וּמִשֶּׁחָרַב בֵּית הַמִּקְדָּשׁ נִסְתַּלְּקָה הַשְּׁכִינָה לַשָּׁמַיִם, שֶׁנֶּאֱמַר: ה' בַּשָּׁמַיִם הֵכִין כִּסְאוֹ. רַבִּי אֶלְעָזָר אוֹמֵר לֹא זָזָה הַשְּׁכִינָה מִתּוֹךְ הַהֵיכָל, שֶׁנֶּאֱמַר: וְהָיוּ עֵינַי וְלִבִּי שָׁם וגו'. וְכֵן הוּא אוֹמֵר: קוֹלִי אֶל ה' אֶקְרָא וַיַּעֲנֵנִי מֵהַר קָדְשׁוֹ סֶלָּה, אַף עַל פִּי שֶׁהוּא חָרֵב הֲרֵי הוּא בִּקְדֻשָּׁתוֹ, בּוֹא וּרְאֵה מַה כּוֹרֶשׁ אוֹמֵר: הוּא הָאֱלֹהִים אֲשֶׁר בִּיְרוּשָׁלָיִם, אָמַר לָהֶן אַף עַל פִּי שֶׁהוּא חָרֵב הָאֱלֹהִים אֵינוֹ זָז מִשָּׁם. אָמַר רַב אַחָא, לְעוֹלָם אֵין הַשְּׁכִינָה זָזָה מִכֹּתֶל מַעֲרָבִי, שֶׁנֶּאֱמַר: הִנֵּה זֶה עוֹמֵד אַחַר כָּתְלֵנוּ, וּכְתִיב: עֵינָיו יֶחֱזוּ עַפְעַפָּיו יִבְחֲנוּ בְּנֵי אָדָם, אָמַר רַבִּי יַנַּאי אַף עַל פִּי שֶׁשְּׁכִינָתוֹ בַּשָּׁמַיִם עֵינָיו יֶחֱזוּ עַפְעַפָּיו יִבְחֲנוּ בְּנֵי אָדָם, מָשָׁל לְמֶלֶךְ שֶׁהָיָה לוֹ פַּרְדֵּס וּבָנָה בוֹ מִגְדָּל גָּבוֹהַּ וְצִוָּה הַמֶּלֶךְ שֶׁיִּתְּנוּ לְתוֹכוֹ פּוֹעֲלִים שֶׁיִּהְיוּ עוֹסְקִים בִּמְלַאכְתּוֹ, אָמַר הַמֶּלֶךְ כָּל מִי שֶׁמִּתְכַּשֵּׁר בִּמְלַאכְתּוֹ יִטֹּל שְׂכָרוֹ מִשָּׁלֵם, וְכָל מִי שֶׁמִּתְעַצֵּל בִּמְלַאכְתּוֹ יִנָּתֵן בְּדִימוֹס. הַמֶּלֶךְ, זֶה מַלְכֵי הַמְּלָכִים, וְהַפַּרְדֵּס, זֶה הָעוֹלָם שֶׁנָּתַן הַקָּדוֹשׁ בָּרוּךְ הוּא לְיִשְׂרָאֵל בְּתוֹכוֹ לִשְׁמֹר הַתּוֹרָה, וְהִתְנָה עִמָּהֶם וְאָמַר, מִי שֶׁהוּא שׁוֹמֵר אֶת הַתּוֹרָה הֲרֵי גַּן עֵדֶן לְפָנָיו, וּמִי שֶׁאֵינוֹ מְשַׁמְּרָהּ, הֲרֵי גֵּיהִנֹּם. אַף הַקָּדוֹשׁ בָּרוּךְ הוּא אַף עַל פִּי שֶׁהוּא נִרְאֶה כִּמְסַלֵּק שְׁכִינָתוֹ מִבֵּית הַמִּקְדָּשׁ, עֵינָיו יֶחֱזוּ עַפְעַפָּיו יִבְחֲנוּ בְּנֵי אָדָם, וּלְמִי בּוֹחֵן, לַצַּדִּיק, שֶׁנֶּאֱמַר: ה' צַדִּיק יִבְחָן, [במה הוא בוחנו], בְּמִרְעֵה צֹאן. בָּדַק לְדָוִד בַּצֹּאן וּמְצָאוֹ רוֹעֶה יָפֶה, שֶׁנֶּאֱמַר: וַיִּקָּחֵהוּ מִמִּכְלְאֹת צֹאן, מַהוּ מִמִּכְלְאֹת צֹאן, כְּמוֹ: וַיִּכָּלֵא הַגֶּשֶׁם, הָיָה מוֹנֵעַ הַגְּדוֹלִים מִפְּנֵי הַקְּטַנִּים, וְהָיָה מוֹצִיא הַקְּטַנִּים לִרְעוֹת, כְּדֵי שֶׁיִּרְעוּ עֵשֶׂב הָרַךְ, וְאַחַר כָּךְ מוֹצִיא הַזְּקֵנִים כְּדֵי שֶׁיִּרְעוּ עֵשֶׂב הַבֵּינוֹנִית, וְאַחַר כָּךְ מוֹצִיא הַבַּחוּרִים שֶׁיִּהְיוּ אוֹכְלִין עֵשֶׂב הַקָּשֶׁה. אָמַר הַקָּדוֹשׁ בָּרוּךְ הוּא, מִי שֶׁהוּא יוֹדֵעַ לִרְעוֹת הַצֹּאן אִישׁ לְפִי כֹחוֹ, יָבֹא וְיִרְעֶה בְּעַמִּי. הֲדָא הוּא דִכְתִיב: מֵאַחַר עָלוֹת הֱבִיאוֹ לִרְעוֹת בְּיַעֲקֹב עַמּוֹ. וְאַף משֶׁה לֹא בְחָנוֹ הַקָּדוֹשׁ בָּרוּךְ הוּא אֶלָּא בַּצֹּאן, אָמְרוּ רַבּוֹתֵינוּ, כְּשֶׁהָיָה משֶׁה רַבֵּינוּ עָלָיו הַשָּׁלוֹם רוֹעֶה צֹאנוֹ שֶׁל יִתְרוֹ בַּמִּדְבָּר, בָּרַח מִמֶּנּוּ גְּדִי, וְרָץ אַחֲרָיו עַד שֶׁהִגִּיעַ לַחֲסִית, כֵּיוָן שֶׁהִגִּיעַ לַחֲסִית, נִזְדַּמְּנָה לוֹ בְּרֵכָה שֶׁל מַיִם, וְעָמַד הַגְּדִי לִשְׁתּוֹת, כֵּיוָן שֶׁהִגִּיעַ משֶׁה אֶצְלוֹ, אָמַר אֲנִי לֹא הָיִיתִי יוֹדֵעַ שֶׁרָץ הָיִיתָ מִפְּנֵי צָמָא, עָיֵף אַתָּה, הִרְכִּיבוֹ עַל כְּתֵפוֹ וְהָיָה מְהַלֵּךְ. אָמַר הַקָּדוֹשׁ בָּרוּךְ הוּא, יֵשׁ לְךָ רַחֲמִים לִנְהֹג צֹאנוֹ שֶׁל בָּשָׂר וָדָם כָּךְ חַיֶּיךָ אַתָּה תִרְעֶה צֹאנִי יִשְׂרָאֵל, הֱוֵי: וּמשֶׁה הָיָה רוֹעֶה.",quote:["וְהָיָה מוֹצִיא הַקְּטַנִּים לִרְעוֹת, כְּדֵי שֶׁיִּרְעוּ עֵשֶׂב הָרַךְ","אָמַר הַקָּדוֹשׁ בָּרוּךְ הוּא, מִי שֶׁהוּא יוֹדֵעַ לִרְעוֹת הַצֹּאן אִישׁ לְפִי כֹחוֹ, יָבֹא וְיִרְעֶה בְּעַמִּי"],status:"in-game",use:"Shorter alternative for the Story.ts:226 toast (mobile / small screens)",gloss:"He brought out the small ones to graze so they would eat the soft grass... Said the Holy One, blessed be He: whoever knows how to shepherd the flock, each according to its strength, let him come and shepherd My people.",crossCheck:"Daat (public domain) consonantal text identical"},s1_17_40_stones:{id:"s1_17_40_stones",kind:"tanakh",ref:"שְׁמוּאֵל א׳ יז, מ",refEn:"I Samuel 17:40",edition:"Miqra according to the Masorah",license:"CC-BY-SA",text:"וַיִּקַּח מַקְלוֹ בְּיָדוֹ וַיִּבְחַר־לוֹ חֲמִשָּׁה חַלֻּקֵי־אֲבָנִים מִן־הַנַּחַל וַיָּשֶׂם אֹתָם בִּכְלִי הָרֹעִים אֲשֶׁר־לוֹ וּבַיַּלְקוּט וְקַלְעוֹ בְיָדוֹ וַיִּגַּשׁ אֶל־הַפְּלִשְׁתִּי",quote:["וַיִּבְחַר־לוֹ חֲמִשָּׁה חַלֻּקֵי־אֲבָנִים מִן־הַנַּחַל וַיָּשֶׂם אֹתָם בִּכְלִי הָרֹעִים"],status:"in-game",use:"Story.ts:288 ui.verse after the five stones are gathered",gloss:"...and chose for himself five smooth stones out of the brook, and put them in the shepherd's bag.",note:'Describes the day of the battle with Goliath; the objective text already frames it as foreshadowing ("כפי שיעשה יום אחד בעמק האלה").',crossCheck:"WLC identical"},jdg_20_16_slingers:{id:"jdg_20_16_slingers",kind:"tanakh",ref:"שׁוֹפְטִים כ, טז",refEn:"Judges 20:16",edition:"Miqra according to the Masorah",license:"CC-BY-SA",text:"מִכֹּל הָעָם הַזֶּה שְׁבַע מֵאוֹת אִישׁ בָּחוּר אִטֵּר יַד־יְמִינוֹ כָּל־זֶה קֹלֵעַ בָּאֶבֶן אֶל־הַשַּׂעֲרָה וְלֹא יַחֲטִא",quote:["כָּל־זֶה קֹלֵעַ בָּאֶבֶן אֶל־הַשַּׂעֲרָה וְלֹא יַחֲטִא"],status:"in-game",use:"Story.ts:304 ui.verse after the first jar breaks",gloss:"...every one of these could sling a stone at a hair and not miss.",note:"Describes the 700 left-handed picked men of Benjamin from Gibeah (20:15) - Saul's tribe and town. Accurate as a statement about Israelite slingers.",crossCheck:"WLC identical"},s1_17_34_bear:{id:"s1_17_34_bear",kind:"tanakh",ref:"שְׁמוּאֵל א׳ יז, לד",refEn:"I Samuel 17:34",edition:"Miqra according to the Masorah",license:"CC-BY-SA",text:"וַיֹּאמֶר דָּוִד אֶל־שָׁאוּל רֹעֶה הָיָה עַבְדְּךָ לְאָבִיו בַּצֹּאן וּבָא הָאֲרִי וְאֶת־הַדּוֹב וְנָשָׂא שֶׂה מֵהָעֵדֶר",quote:["וּבָא הָאֲרִי וְאֶת־הַדּוֹב וְנָשָׂא שֶׂה מֵהָעֵדֶר"],status:"in-game",use:"Story.ts:568 ui.verse when the bear appears",gloss:"...and there came a lion, and also a bear, and took a lamb out of the flock.",crossCheck:"WLC identical"},s1_17_35_went_after:{id:"s1_17_35_went_after",kind:"tanakh",ref:"שְׁמוּאֵל א׳ יז, לה",refEn:"I Samuel 17:35",edition:"Miqra according to the Masorah",license:"CC-BY-SA",text:"וְיָצָאתִי אַחֲרָיו וְהִכִּתִיו וְהִצַּלְתִּי מִפִּיו וַיָּקָם עָלַי וְהֶחֱזַקְתִּי בִּזְקָנוֹ וְהִכִּתִיו וַהֲמִיתִּיו",quote:["וְיָצָאתִי אַחֲרָיו"],status:"in-game",use:"Story.ts:625 objective sub (quoted word)",gloss:"And I went out after him",crossCheck:"WLC identical"},s1_17_35_smote:{id:"s1_17_35_smote",kind:"tanakh",ref:"שְׁמוּאֵל א׳ יז, לה",refEn:"I Samuel 17:35",edition:"Miqra according to the Masorah",license:"CC-BY-SA",text:"וְיָצָאתִי אַחֲרָיו וְהִכִּתִיו וְהִצַּלְתִּי מִפִּיו וַיָּקָם עָלַי וְהֶחֱזַקְתִּי בִּזְקָנוֹ וְהִכִּתִיו וַהֲמִיתִּיו",quote:["וְהִכִּתִיו"],status:"in-game",use:"Story.ts:650 objective sub (quoted word)",gloss:"and smote him",crossCheck:"WLC identical"},s1_17_35_delivered:{id:"s1_17_35_delivered",kind:"tanakh",ref:"שְׁמוּאֵל א׳ יז, לה",refEn:"I Samuel 17:35",edition:"Miqra according to the Masorah",license:"CC-BY-SA",text:"וְיָצָאתִי אַחֲרָיו וְהִכִּתִיו וְהִצַּלְתִּי מִפִּיו וַיָּקָם עָלַי וְהֶחֱזַקְתִּי בִּזְקָנוֹ וְהִכִּתִיו וַהֲמִיתִּיו",quote:["וְהִצַּלְתִּי מִפִּיו"],status:"in-game",use:"Story.ts:697 objective sub (quoted words)",gloss:"and delivered it out of his mouth",crossCheck:"WLC identical"},s1_17_35_smote_delivered:{id:"s1_17_35_smote_delivered",kind:"tanakh",ref:"שְׁמוּאֵל א׳ יז, לה",refEn:"I Samuel 17:35",edition:"Miqra according to the Masorah",license:"CC-BY-SA",text:"וְיָצָאתִי אַחֲרָיו וְהִכִּתִיו וְהִצַּלְתִּי מִפִּיו וַיָּקָם עָלַי וְהֶחֱזַקְתִּי בִּזְקָנוֹ וְהִכִּתִיו וַהֲמִיתִּיו",quote:["וְהִכִּתִיו וְהִצַּלְתִּי מִפִּיו"],status:"in-game",use:"Story.ts:760 ui.verse",gloss:"and smote him, and delivered it out of his mouth",crossCheck:"WLC identical"},s1_17_35_rose:{id:"s1_17_35_rose",kind:"tanakh",ref:"שְׁמוּאֵל א׳ יז, לה",refEn:"I Samuel 17:35",edition:"Miqra according to the Masorah",license:"CC-BY-SA",text:"וְיָצָאתִי אַחֲרָיו וְהִכִּתִיו וְהִצַּלְתִּי מִפִּיו וַיָּקָם עָלַי וְהֶחֱזַקְתִּי בִּזְקָנוֹ וְהִכִּתִיו וַהֲמִיתִּיו",quote:["וַיָּקָם עָלַי"],status:"in-game",use:"Story.ts:821 ui.verse",gloss:"and when he arose against me",crossCheck:"WLC identical"},s1_17_35_beard:{id:"s1_17_35_beard",kind:"tanakh",ref:"שְׁמוּאֵל א׳ יז, לה",refEn:"I Samuel 17:35",edition:"Miqra according to the Masorah",license:"CC-BY-SA",text:"וְיָצָאתִי אַחֲרָיו וְהִכִּתִיו וְהִצַּלְתִּי מִפִּיו וַיָּקָם עָלַי וְהֶחֱזַקְתִּי בִּזְקָנוֹ וְהִכִּתִיו וַהֲמִיתִּיו",quote:["וְהֶחֱזַקְתִּי בִּזְקָנוֹ"],status:"in-game",use:"Story.ts:923 ui.verse",gloss:"I caught him by his beard",crossCheck:"WLC identical"},s1_17_35_slew:{id:"s1_17_35_slew",kind:"tanakh",ref:"שְׁמוּאֵל א׳ יז, לה",refEn:"I Samuel 17:35",edition:"Miqra according to the Masorah",license:"CC-BY-SA",text:"וְיָצָאתִי אַחֲרָיו וְהִכִּתִיו וְהִצַּלְתִּי מִפִּיו וַיָּקָם עָלַי וְהֶחֱזַקְתִּי בִּזְקָנוֹ וְהִכִּתִיו וַהֲמִיתִּיו",quote:["וְהִכִּתִיו וַהֲמִיתִּיו"],status:"in-game",use:"Story.ts:994 ui.verse",gloss:"and smote him, and slew him",crossCheck:"WLC identical"},ps_23_1_shepherd:{id:"ps_23_1_shepherd",kind:"tanakh",ref:"תְּהִלִּים כג, א",refEn:"Psalms 23:1",edition:"Miqra according to the Masorah",license:"CC-BY-SA",text:"מִזְמוֹר לְדָוִד ה׳ רֹעִי לֹא אֶחְסָר",quote:["ה׳ רֹעִי לֹא אֶחְסָר"],status:"in-game",use:"Story.ts:880 ui.verse during the dodge phase",gloss:"The LORD is my shepherd; I shall not want.",crossCheck:"WLC identical"},ps_23_1_2_loading:{id:"ps_23_1_2_loading",kind:"tanakh",ref:"תְּהִלִּים כג, א–ב",refEn:"Psalms 23:1-2",edition:"Miqra according to the Masorah",license:"CC-BY-SA",text:"מִזְמוֹר לְדָוִד ה׳ רֹעִי לֹא אֶחְסָר בִּנְאוֹת דֶּשֶׁא יַרְבִּיצֵנִי עַל־מֵי מְנֻחוֹת יְנַהֲלֵנִי",quote:["ה׳ רֹעִי לֹא אֶחְסָר בִּנְאוֹת דֶּשֶׁא יַרְבִּיצֵנִי"],status:"in-game",use:'UI.ts:55 loading screen quote (ref was "תהלים כג"; now "תְּהִלִּים כג, א–ב")',gloss:"The LORD is my shepherd; I shall not want. He makes me lie down in green pastures.",note:"Spans the end of v.1 and the start of v.2 (verses joined by a single space).",crossCheck:"WLC identical"},s1_17_37_delivered_me:{id:"s1_17_37_delivered_me",kind:"tanakh",ref:"שְׁמוּאֵל א׳ יז, לז",refEn:"I Samuel 17:37",edition:"Miqra according to the Masorah",license:"CC-BY-SA",text:"וַיֹּאמֶר דָּוִד ה׳ אֲשֶׁר הִצִּלַנִי מִיַּד הָאֲרִי וּמִיַּד הַדֹּב הוּא יַצִּילֵנִי מִיַּד הַפְּלִשְׁתִּי הַזֶּה וַיֹּאמֶר שָׁאוּל אֶל־דָּוִד לֵךְ וַה׳ יִהְיֶה עִמָּךְ",quote:["ה׳ אֲשֶׁר הִצִּלַנִי מִיַּד הָאֲרִי וּמִיַּד הַדֹּב הוּא יַצִּילֵנִי"],status:"in-game",use:"Story.ts:1086 ending ui.verse",gloss:"The LORD who delivered me from the paw of the lion and from the paw of the bear, He will deliver me.",crossCheck:"WLC identical"},ps_23_4_rod_staff:{id:"ps_23_4_rod_staff",kind:"tanakh",ref:"תְּהִלִּים כג, ד",refEn:"Psalms 23:4",edition:"Miqra according to the Masorah",license:"CC-BY-SA",text:"גַּם כִּי־אֵלֵךְ בְּגֵיא צַלְמָוֶת לֹא־אִירָא רָע כִּי־אַתָּה עִמָּדִי שִׁבְטְךָ וּמִשְׁעַנְתֶּךָ הֵמָּה יְנַחֲמֻנִי",quote:["גַּם כִּי־אֵלֵךְ בְּגֵיא צַלְמָוֶת לֹא־אִירָא רָע כִּי־אַתָּה עִמָּדִי שִׁבְטְךָ וּמִשְׁעַנְתֶּךָ הֵמָּה יְנַחֲמֻנִי"],status:"in-game",use:"Story.ts:1087 ending ui.verse",gloss:"Even when I walk in the valley of deep darkness I fear no evil, for You are with me; Your rod and Your staff, they comfort me.",crossCheck:"WLC identical"},s1_17_36_37_endcard:{id:"s1_17_36_37_endcard",kind:"tanakh",ref:"שְׁמוּאֵל א׳ יז, לו–לז",refEn:"I Samuel 17:36-37",edition:"Miqra according to the Masorah",license:"CC-BY-SA",text:"גַּם אֶת־הָאֲרִי גַּם־הַדֹּב הִכָּה עַבְדֶּךָ וְהָיָה הַפְּלִשְׁתִּי הֶעָרֵל הַזֶּה כְּאַחַד מֵהֶם כִּי חֵרֵף מַעַרְכֹת אֱלֹהִים חַיִּים וַיֹּאמֶר דָּוִד ה׳ אֲשֶׁר הִצִּלַנִי מִיַּד הָאֲרִי וּמִיַּד הַדֹּב הוּא יַצִּילֵנִי מִיַּד הַפְּלִשְׁתִּי הַזֶּה וַיֹּאמֶר שָׁאוּל אֶל־דָּוִד לֵךְ וַה׳ יִהְיֶה עִמָּךְ",quote:["גַּם אֶת־הָאֲרִי גַּם־הַדֹּב הִכָּה עַבְדֶּךָ","ה׳ אֲשֶׁר הִצִּלַנִי מִיַּד הָאֲרִי וּמִיַּד הַדֹּב הוּא יַצִּילֵנִי מִיַּד הַפְּלִשְׁתִּי הַזֶּה"],status:"in-game",use:"UI.ts:327 end card",gloss:"Your servant smote both the lion and the bear... The LORD who delivered me from the paw of the lion and from the paw of the bear, He will deliver me from the hand of this Philistine.",note:"MAM (Aleppo) spells הַדֹּב in 17:36; the Leningrad codex (WLC) has הַדּוֹב. We follow MAM.",crossCheck:"WLC differs in: גַּם אֶת־הָאֲרִי גַּם־הַדֹּב הִכָּה עַבְדֶּךָ"},s1_16_1_fill_horn:{id:"s1_16_1_fill_horn",kind:"tanakh",ref:"שְׁמוּאֵל א׳ טז, א",refEn:"I Samuel 16:1",edition:"Miqra according to the Masorah",license:"CC-BY-SA",text:"וַיֹּאמֶר ה׳ אֶל־שְׁמוּאֵל עַד־מָתַי אַתָּה מִתְאַבֵּל אֶל־שָׁאוּל וַאֲנִי מְאַסְתִּיו מִמְּלֹךְ עַל־יִשְׂרָאֵל מַלֵּא קַרְנְךָ שֶׁמֶן וְלֵךְ אֶשְׁלָחֲךָ אֶל־יִשַׁי בֵּית־הַלַּחְמִי כִּי־רָאִיתִי בְּבָנָיו לִי מֶלֶךְ",quote:["מַלֵּא קַרְנְךָ שֶׁמֶן וְלֵךְ אֶשְׁלָחֲךָ אֶל־יִשַׁי בֵּית־הַלַּחְמִי כִּי־רָאִיתִי בְּבָנָיו לִי מֶלֶךְ"],status:"in-game",use:"UI.ts:328 end card - next-chapter teaser",gloss:"Fill your horn with oil and go; I will send you to Jesse the Bethlehemite, for I have provided Me a king among his sons.",crossCheck:"WLC identical"},s1_15_34_gibeah_home:{id:"s1_15_34_gibeah_home",kind:"tanakh",ref:"שְׁמוּאֵל א׳ טו, לד",refEn:"I Samuel 15:34",edition:"Miqra according to the Masorah",license:"CC-BY-SA",text:"וַיֵּלֶךְ שְׁמוּאֵל הָרָמָתָה וְשָׁאוּל עָלָה אֶל־בֵּיתוֹ גִּבְעַת שָׁאוּל",quote:["וְשָׁאוּל עָלָה אֶל־בֵּיתוֹ גִּבְעַת שָׁאוּל"],status:"intro",use:"Intro beat G1 - establishing shot of Gibeah of Saul",gloss:"...and Saul went up to his house, to Gibeah of Saul.",note:"The last verse about Saul before 16:1 - exactly the moment of the intro.",crossCheck:"WLC identical"},s1_15_35_samuel_mourned:{id:"s1_15_35_samuel_mourned",kind:"tanakh",ref:"שְׁמוּאֵל א׳ טו, לה",refEn:"I Samuel 15:35",edition:"Miqra according to the Masorah",license:"CC-BY-SA",text:"וְלֹא־יָסַף שְׁמוּאֵל לִרְאוֹת אֶת־שָׁאוּל עַד־יוֹם מוֹתוֹ כִּי־הִתְאַבֵּל שְׁמוּאֵל אֶל־שָׁאוּל וַה׳ נִחָם כִּי־הִמְלִיךְ אֶת־שָׁאוּל עַל־יִשְׂרָאֵל",quote:["וְלֹא־יָסַף שְׁמוּאֵל לִרְאוֹת אֶת־שָׁאוּל עַד־יוֹם מוֹתוֹ כִּי־הִתְאַבֵּל שְׁמוּאֵל אֶל־שָׁאוּל"],status:"intro",use:"Intro beat G4 - Saul alone in his hall / Samuel's absence",gloss:"And Samuel saw Saul no more until the day of his death, for Samuel mourned for Saul.",crossCheck:"WLC identical"},s1_9_2_tallest:{id:"s1_9_2_tallest",kind:"tanakh",ref:"שְׁמוּאֵל א׳ ט, ב",refEn:"I Samuel 9:2",edition:"Miqra according to the Masorah",license:"CC-BY-SA",text:"וְלוֹ־הָיָה בֵן וּשְׁמוֹ שָׁאוּל בָּחוּר וָטוֹב וְאֵין אִישׁ מִבְּנֵי יִשְׂרָאֵל טוֹב מִמֶּנּוּ מִשִּׁכְמוֹ וָמַעְלָה גָּבֹהַּ מִכָּל־הָעָם",quote:["בָּחוּר וָטוֹב וְאֵין אִישׁ מִבְּנֵי יִשְׂרָאֵל טוֹב מִמֶּנּוּ מִשִּׁכְמוֹ וָמַעְלָה גָּבֹהַּ מִכָּל־הָעָם"],status:"intro",use:"Intro beat G2 - first full view of Saul",gloss:"...a choice young man and goodly; there was not among the children of Israel a goodlier person than he; from his shoulders and upward he was taller than any of the people.",note:"Describes Saul when he was chosen (years earlier); the portrait still holds.",crossCheck:"WLC identical"},s1_9_2_head_above:{id:"s1_9_2_head_above",kind:"tanakh",ref:"שְׁמוּאֵל א׳ ט, ב",refEn:"I Samuel 9:2",edition:"Miqra according to the Masorah",license:"CC-BY-SA",text:"וְלוֹ־הָיָה בֵן וּשְׁמוֹ שָׁאוּל בָּחוּר וָטוֹב וְאֵין אִישׁ מִבְּנֵי יִשְׂרָאֵל טוֹב מִמֶּנּוּ מִשִּׁכְמוֹ וָמַעְלָה גָּבֹהַּ מִכָּל־הָעָם",quote:["מִשִּׁכְמוֹ וָמַעְלָה גָּבֹהַּ מִכָּל־הָעָם"],status:"intro",use:"Short form of s1_9_2_tallest",gloss:"from his shoulders and upward he was taller than any of the people",crossCheck:"WLC identical"},s1_10_23_head_above:{id:"s1_10_23_head_above",kind:"tanakh",ref:"שְׁמוּאֵל א׳ י, כג",refEn:"I Samuel 10:23",edition:"Miqra according to the Masorah",license:"CC-BY-SA",text:"וַיָּרֻצוּ וַיִּקָּחֻהוּ מִשָּׁם וַיִּתְיַצֵּב בְּתוֹךְ הָעָם וַיִּגְבַּהּ מִכָּל־הָעָם מִשִּׁכְמוֹ וָמָעְלָה",quote:["וַיִּגְבַּהּ מִכָּל־הָעָם מִשִּׁכְמוֹ וָמָעְלָה"],status:"intro",use:"Alternative to s1_9_2_head_above",gloss:"...and he was taller than any of the people from his shoulders and upward.",crossCheck:"WLC identical"},s1_10_26_valiant_men:{id:"s1_10_26_valiant_men",kind:"tanakh",ref:"שְׁמוּאֵל א׳ י, כו",refEn:"I Samuel 10:26",edition:"Miqra according to the Masorah",license:"CC-BY-SA",text:"וְגַם־שָׁאוּל הָלַךְ לְבֵיתוֹ גִּבְעָתָה וַיֵּלְכוּ עִמּוֹ הַחַיִל אֲשֶׁר־נָגַע אֱלֹהִים בְּלִבָּם",quote:["וְגַם־שָׁאוּל הָלַךְ לְבֵיתוֹ גִּבְעָתָה וַיֵּלְכוּ עִמּוֹ הַחַיִל אֲשֶׁר־נָגַע אֱלֹהִים בְּלִבָּם"],status:"intro",use:"Intro beat G1/G3 - Saul's men at Gibeah",gloss:"And Saul also went to his house to Gibeah, and there went with him the band of men whose hearts God had touched.",crossCheck:"WLC identical"},s1_22_6_tamarisk:{id:"s1_22_6_tamarisk",kind:"tanakh",ref:"שְׁמוּאֵל א׳ כב, ו",refEn:"I Samuel 22:6",edition:"Miqra according to the Masorah",license:"CC-BY-SA",text:"וַיִּשְׁמַע שָׁאוּל כִּי נוֹדַע דָּוִד וַאֲנָשִׁים אֲשֶׁר אִתּוֹ וְשָׁאוּל יוֹשֵׁב בַּגִּבְעָה תַּחַת־הָאֶשֶׁל בָּרָמָה וַחֲנִיתוֹ בְיָדוֹ וְכָל־עֲבָדָיו נִצָּבִים עָלָיו",quote:["וְשָׁאוּל יוֹשֵׁב בַּגִּבְעָה תַּחַת־הָאֶשֶׁל בָּרָמָה וַחֲנִיתוֹ בְיָדוֹ וְכָל־עֲבָדָיו נִצָּבִים עָלָיו"],status:"intro",use:"Intro beat G3 - Saul holding court under the tamarisk, spear in hand",gloss:"...and Saul was sitting in Gibeah under the tamarisk tree on the height, with his spear in his hand, and all his servants standing about him.",note:"Chronology: this scene is from a later time (David already a fugitive). The quoted words omit the first clause about David and show only the portrait of Saul's court.",crossCheck:"WLC identical"},s1_14_47_took_kingship:{id:"s1_14_47_took_kingship",kind:"tanakh",ref:"שְׁמוּאֵל א׳ יד, מז",refEn:"I Samuel 14:47",edition:"Miqra according to the Masorah",license:"CC-BY-SA",text:"וְשָׁאוּל לָכַד הַמְּלוּכָה עַל־יִשְׂרָאֵל וַיִּלָּחֶם סָבִיב בְּכָל־אֹיְבָיו בְּמוֹאָב וּבִבְנֵי־עַמּוֹן וּבֶאֱדוֹם וּבְמַלְכֵי צוֹבָה וּבַפְּלִשְׁתִּים וּבְכֹל אֲשֶׁר־יִפְנֶה יַרְשִׁיעַ",quote:["וְשָׁאוּל לָכַד הַמְּלוּכָה עַל־יִשְׂרָאֵל וַיִּלָּחֶם סָבִיב בְּכָל־אֹיְבָיו","וּבְכֹל אֲשֶׁר־יִפְנֶה יַרְשִׁיעַ"],status:"intro",use:"Intro beat G3 - Saul as a victorious warrior-king",gloss:"So Saul took the kingdom over Israel and fought against all his enemies on every side... and wherever he turned, he vanquished them.",crossCheck:"WLC identical"},s1_14_50_abner:{id:"s1_14_50_abner",kind:"tanakh",ref:"שְׁמוּאֵל א׳ יד, נ",refEn:"I Samuel 14:50",edition:"Miqra according to the Masorah",license:"CC-BY-SA",text:"וְשֵׁם אֵשֶׁת שָׁאוּל אֲחִינֹעַם בַּת־אֲחִימָעַץ וְשֵׁם שַׂר־צְבָאוֹ אֲבִינֵר בֶּן־נֵר דּוֹד שָׁאוּל",quote:["וְשֵׁם שַׂר־צְבָאוֹ אֲבִינֵר בֶּן־נֵר דּוֹד שָׁאוּל"],status:"intro",use:"Caption for Abner, commander of the army",gloss:"...and the name of the captain of his host was Abner son of Ner, Saul's uncle.",note:"The verse spells the name אֲבִינֵר; elsewhere אַבְנֵר.",crossCheck:"WLC identical"},s1_14_52_mighty_men:{id:"s1_14_52_mighty_men",kind:"tanakh",ref:"שְׁמוּאֵל א׳ יד, נב",refEn:"I Samuel 14:52",edition:"Miqra according to the Masorah",license:"CC-BY-SA",text:"וַתְּהִי הַמִּלְחָמָה חֲזָקָה עַל־פְּלִשְׁתִּים כֹּל יְמֵי שָׁאוּל וְרָאָה שָׁאוּל כָּל־אִישׁ גִּבּוֹר וְכָל־בֶּן־חַיִל וַיַּאַסְפֵהוּ אֵלָיו",quote:["וַתְּהִי הַמִּלְחָמָה חֲזָקָה עַל־פְּלִשְׁתִּים כֹּל יְמֵי שָׁאוּל וְרָאָה שָׁאוּל כָּל־אִישׁ גִּבּוֹר וְכָל־בֶּן־חַיִל וַיַּאַסְפֵהוּ אֵלָיו"],status:"intro",use:"Intro beat G3 - the warriors of the royal guard",gloss:"And there was sore war against the Philistines all the days of Saul; and whenever Saul saw any mighty man or any valiant man, he took him unto him.",crossCheck:"WLC identical"},s1_15_28_torn_kingdom:{id:"s1_15_28_torn_kingdom",kind:"tanakh",ref:"שְׁמוּאֵל א׳ טו, כח",refEn:"I Samuel 15:28",edition:"Miqra according to the Masorah",license:"CC-BY-SA",text:"וַיֹּאמֶר אֵלָיו שְׁמוּאֵל קָרַע ה׳ אֶת־מַמְלְכוּת יִשְׂרָאֵל מֵעָלֶיךָ הַיּוֹם וּנְתָנָהּ לְרֵעֲךָ הַטּוֹב מִמֶּךָּ",quote:["קָרַע ה׳ אֶת־מַמְלְכוּת יִשְׂרָאֵל מֵעָלֶיךָ הַיּוֹם וּנְתָנָהּ לְרֵעֲךָ הַטּוֹב מִמֶּךָּ"],status:"intro",use:"Intro transition G4 -> Bethlehem (cut from Saul to David)",gloss:"The LORD has torn the kingdom of Israel from you this day, and has given it to a neighbour of yours who is better than you.",note:"Samuel to Saul at Gilgal (ch. 15), shortly before the intro. Safe to show.",crossCheck:"WLC identical"},s1_13_14_after_his_heart:{id:"s1_13_14_after_his_heart",kind:"tanakh",ref:"שְׁמוּאֵל א׳ יג, יד",refEn:"I Samuel 13:14",edition:"Miqra according to the Masorah",license:"CC-BY-SA",text:"וְעַתָּה מַמְלַכְתְּךָ לֹא־תָקוּם בִּקֵּשׁ ה׳ לוֹ אִישׁ כִּלְבָבוֹ וַיְצַוֵּהוּ ה׳ לְנָגִיד עַל־עַמּוֹ כִּי לֹא שָׁמַרְתָּ אֵת אֲשֶׁר־צִוְּךָ ה׳",quote:["בִּקֵּשׁ ה׳ לוֹ אִישׁ כִּלְבָבוֹ"],status:"intro",use:"Alternative transition line (Saul -> David)",gloss:"The LORD has sought for Himself a man after His own heart.",crossCheck:"WLC identical"},s1_16_7_looks_heart:{id:"s1_16_7_looks_heart",kind:"tanakh",ref:"שְׁמוּאֵל א׳ טז, ז",refEn:"I Samuel 16:7",edition:"Miqra according to the Masorah",license:"CC-BY-SA",text:"וַיֹּאמֶר ה׳ אֶל־שְׁמוּאֵל אַל־תַּבֵּט אֶל־מַרְאֵהוּ וְאֶל־גְּבֹהַּ קוֹמָתוֹ כִּי מְאַסְתִּיהוּ כִּי לֹא אֲשֶׁר יִרְאֶה הָאָדָם כִּי הָאָדָם יִרְאֶה לַעֵינַיִם וַה׳ יִרְאֶה לַלֵּבָב",quote:["כִּי הָאָדָם יִרְאֶה לַעֵינַיִם וַה׳ יִרְאֶה לַלֵּבָב"],status:"intro",use:"Closing thought of the contrast (tall king / youngest shepherd)",gloss:"For man looks on the outward appearance, but the LORD looks on the heart.",note:"Said to Samuel about Eliab on the day of the anointing (16:7). Radak cites an opinion that it also answers Samuel's attachment to tall, handsome Saul. Show only with the reference; do not caption it as said about Saul.",crossCheck:"WLC identical"},s1_15_17_small_in_eyes:{id:"s1_15_17_small_in_eyes",kind:"tanakh",ref:"שְׁמוּאֵל א׳ טו, יז",refEn:"I Samuel 15:17",edition:"Miqra according to the Masorah",license:"CC-BY-SA",text:"וַיֹּאמֶר שְׁמוּאֵל הֲלוֹא אִם־קָטֹן אַתָּה בְּעֵינֶיךָ רֹאשׁ שִׁבְטֵי יִשְׂרָאֵל אָתָּה וַיִּמְשָׁחֲךָ ה׳ לְמֶלֶךְ עַל־יִשְׂרָאֵל",quote:["הֲלוֹא אִם־קָטֹן אַתָּה בְּעֵינֶיךָ רֹאשׁ שִׁבְטֵי יִשְׂרָאֵל אָתָּה"],status:"intro",use:"Optional line for Saul's hall (Samuel's rebuke at Gilgal)",gloss:"Though you are small in your own eyes, are you not head of the tribes of Israel?",crossCheck:"WLC identical"},ps_78_70_71_chose_david:{id:"ps_78_70_71_chose_david",kind:"tanakh",ref:"תְּהִלִּים עח, ע–עא",refEn:"Psalms 78:70-71",edition:"Miqra according to the Masorah",license:"CC-BY-SA",text:"וַיִּבְחַר בְּדָוִד עַבְדּוֹ וַיִּקָּחֵהוּ מִמִּכְלְאֹת צֹאן מֵאַחַר עָלוֹת הֱבִיאוֹ לִרְעוֹת בְּיַעֲקֹב עַמּוֹ וּבְיִשְׂרָאֵל נַחֲלָתוֹ",quote:["וַיִּבְחַר בְּדָוִד עַבְדּוֹ וַיִּקָּחֵהוּ מִמִּכְלְאֹת צֹאן מֵאַחַר עָלוֹת הֱבִיאוֹ לִרְעוֹת בְּיַעֲקֹב עַמּוֹ וּבְיִשְׂרָאֵל נַחֲלָתוֹ"],status:"intro",use:"Intro final line before the title card (or ending)",gloss:"He chose David His servant and took him from the sheepfolds; from following the nursing ewes He brought him to shepherd Jacob His people and Israel His inheritance.",note:"These are exactly the verses Shemot Rabbah 2:2 expounds.",crossCheck:"WLC identical"},ps_78_70_chose_david:{id:"ps_78_70_chose_david",kind:"tanakh",ref:"תְּהִלִּים עח, ע",refEn:"Psalms 78:70",edition:"Miqra according to the Masorah",license:"CC-BY-SA",text:"וַיִּבְחַר בְּדָוִד עַבְדּוֹ וַיִּקָּחֵהוּ מִמִּכְלְאֹת צֹאן",quote:["וַיִּבְחַר בְּדָוִד עַבְדּוֹ וַיִּקָּחֵהוּ מִמִּכְלְאֹת צֹאן"],status:"intro",use:"Short form of ps_78_70_71_chose_david",gloss:"He chose David His servant and took him from the sheepfolds.",crossCheck:"WLC identical"},s2_1_23_eagles_lions:{id:"s2_1_23_eagles_lions",kind:"tanakh",ref:"שְׁמוּאֵל ב׳ א, כג",refEn:"II Samuel 1:23",edition:"Miqra according to the Masorah",license:"CC-BY-SA",text:"שָׁאוּל וִיהוֹנָתָן הַנֶּאֱהָבִים וְהַנְּעִימִם בְּחַיֵּיהֶם וּבְמוֹתָם לֹא נִפְרָדוּ מִנְּשָׁרִים קַלּוּ מֵאֲרָיוֹת גָּבֵרוּ",quote:["מִנְּשָׁרִים קַלּוּ מֵאֲרָיוֹת גָּבֵרוּ"],status:"intro",use:"Optional: Saul and his warriors (David's later lament - use with the reference)",gloss:"They were swifter than eagles, they were stronger than lions.",note:"From David's lament over Saul and Jonathan (2 Sam 1). Proleptic; never caption it as a statement of this moment.",crossCheck:"WLC identical"},s2_7_8_from_pasture:{id:"s2_7_8_from_pasture",kind:"tanakh",ref:"שְׁמוּאֵל ב׳ ז, ח",refEn:"II Samuel 7:8",edition:"Miqra according to the Masorah",license:"CC-BY-SA",text:"וְעַתָּה כֹּה־תֹאמַר לְעַבְדִּי לְדָוִד כֹּה אָמַר ה׳ צְבָאוֹת אֲנִי לְקַחְתִּיךָ מִן־הַנָּוֶה מֵאַחַר הַצֹּאן לִהְיוֹת נָגִיד עַל־עַמִּי עַל־יִשְׂרָאֵל",quote:["אֲנִי לְקַחְתִּיךָ מִן־הַנָּוֶה מֵאַחַר הַצֹּאן לִהְיוֹת נָגִיד עַל־עַמִּי עַל־יִשְׂרָאֵל"],status:"ending",use:"End card / epilogue line",gloss:"I took you from the pasture, from following the sheep, to be prince over My people, over Israel.",crossCheck:"WLC identical"}};function zs(r){const t=ra[r];return t.quote&&t.quote.length?t.quote.join($x):t.text}function Io(r){return ra[r].ref}function _n(r){return[zs(r),ra[r].ref]}function Kx(r,t=" · "){return`<span class="src-quote" style="font-family:var(--serif-he);letter-spacing:0;font-weight:400">"${zs(r)}"</span>${t}<span class="src-ref" style="white-space:nowrap">${ra[r].ref}</span>`}const Le=(r,t,e="")=>{const n=document.createElement(r);return n.className=t,e&&(n.innerHTML=e),n};class Zx{constructor(t,e){b(this,"root");b(this,"loading");b(this,"loadBar");b(this,"loadLabel");b(this,"bars");b(this,"captionEl");b(this,"verseEl");b(this,"titleEl");b(this,"objEl");b(this,"promptEl");b(this,"crossEl");b(this,"markerEl");b(this,"healthEl");b(this,"bossEl");b(this,"qteEl");b(this,"toastEl");b(this,"fadeEl");b(this,"skipEl");b(this,"counterEl");b(this,"hintEl");b(this,"pauseEl");b(this,"endEl");b(this,"timers",new Map);b(this,"touch");b(this,"onSkip");b(this,"onResume");b(this,"onRestart");b(this,"onVolume");b(this,"onSensitivity");this.touch=e,this.root=Le("div","ui"+(e?" is-touch":"")),t.appendChild(this.root),this.loading=Le("div","loading",`
      <div class="ld-inner">
        <div class="ld-title">DAVID</div>
        <div class="ld-bar"><div></div></div>
        <div class="ld-label"></div>
        <div class="ld-quote">"${zs("ps_23_1_2_loading")}"<span>${Io("ps_23_1_2_loading")}</span></div>
      </div>`),this.loadBar=this.loading.querySelector(".ld-bar div"),this.loadLabel=this.loading.querySelector(".ld-label"),this.root.appendChild(this.loading),this.bars=Le("div","letterbox",'<div class="lb-top"></div><div class="lb-bot"></div>'),this.captionEl=Le("div","caption"),this.verseEl=Le("div","verse"),this.titleEl=Le("div","titlecard",`
      <div class="tc-small">מִסִּפְרֵי שְׁמוּאֵל</div>
      <h1 class="tc-title" data-t="DAVID">DAVID</h1>
      <div class="tc-he">דָּוִד</div>
      <div class="tc-line"></div>
      <div class="tc-chapter">פֶּרֶק רִאשׁוֹן · הָרֹעֶה</div>`),this.objEl=Le("div","objective"),this.hintEl=Le("div","hint"),this.promptEl=Le("div","prompt"),this.crossEl=Le("div","crosshair",'<svg viewBox="0 0 100 100"><circle class="ring-bg" cx="50" cy="50" r="30"/><circle class="ring" cx="50" cy="50" r="30"/><circle class="dot" cx="50" cy="50" r="2.6"/></svg><div class="range">מחוץ לטווח — סובב חזק יותר</div>'),this.markerEl=Le("div","marker",'<div class="mk-diamond"></div><div class="mk-label"></div>'),this.healthEl=Le("div","health"),this.bossEl=Le("div","boss",'<div class="boss-name">הַדֹּב</div><div class="boss-bar"><div></div></div>'),this.qteEl=Le("div","qte"),this.toastEl=Le("div","toast"),this.counterEl=Le("div","counter"),this.fadeEl=Le("div","fade"),this.skipEl=Le("button","skip",e?"דלג ›":'דלג <span class="key">Enter</span>'),this.skipEl.addEventListener("click",n=>{n.stopPropagation(),this.onSkip?.()}),this.pauseEl=Le("div","pause"),this.endEl=Le("div","endcard");for(const n of[this.bars,this.markerEl,this.captionEl,this.verseEl,this.titleEl,this.objEl,this.hintEl,this.promptEl,this.crossEl,this.healthEl,this.bossEl,this.qteEl,this.toastEl,this.counterEl,this.skipEl,this.fadeEl,this.pauseEl,this.endEl])this.root.appendChild(n);this.buildPause()}setLoading(t,e){this.loadBar.style.width=`${Math.round(t*100)}%`,this.loadLabel.textContent=e}showStart(t,e){this.loading.classList.add("ready");const n=this.loading.querySelector(".ld-inner"),i=Le("button","start-btn","הַתְחֵל"),s=Le("div","start-note",`${this.touch?"מומלץ לסובב את המכשיר לרוחב · ":"מסך מלא ואוזניות לחוויה המלאה · "}איכות: ${t}`);n.appendChild(i),n.appendChild(s),i.addEventListener("click",async()=>{i.disabled=!0;try{this.touch&&document.documentElement.requestFullscreen&&await document.documentElement.requestFullscreen().catch(()=>{})}catch{}this.loading.classList.add("gone"),setTimeout(()=>this.loading.remove(),1600),e()})}dismissLoading(){this.loading.classList.add("gone"),setTimeout(()=>this.loading.remove(),1600)}showError(t){this.loadLabel.textContent=t,this.loadLabel.classList.add("err")}letterbox(t){this.bars.classList.toggle("on",t),this.root.classList.toggle("cinematic",t)}skip(t){this.skipEl.classList.toggle("on",t)}later(t,e,n){const i=this.timers.get(t);i&&clearTimeout(i),this.timers.set(t,window.setTimeout(n,e))}caption(t,e="",n=5){this.captionEl.innerHTML=`<div class="cap-title">${t}</div>${e?`<div class="cap-sub">${e}</div>`:""}`,this.captionEl.classList.remove("on"),this.captionEl.offsetWidth,this.captionEl.classList.add("on"),this.later("caption",n*1e3,()=>this.captionEl.classList.remove("on"))}verse(t,e,n=6){this.verseEl.innerHTML=`<div class="v-text">${t}</div>${e?`<div class="v-ref">${e}</div>`:""}`,this.verseEl.classList.remove("on"),this.verseEl.offsetWidth,this.verseEl.classList.add("on"),this.later("verse",n*1e3,()=>this.verseEl.classList.remove("on"))}hideVerse(){this.verseEl.classList.remove("on")}titleCard(t){this.titleEl.classList.toggle("on",t)}objective(t,e=""){if(!t){this.objEl.classList.remove("on");return}this.objEl.innerHTML=`<div class="obj-label">מְשִׂימָה</div><div class="obj-text">${t}</div>${e?`<div class="obj-sub">${e}</div>`:""}`,this.objEl.classList.remove("on","new"),this.objEl.offsetWidth,this.objEl.classList.add("on","new")}hint(t,e=0){if(!t){this.hintEl.classList.remove("on");return}typeof t=="string"?this.hintEl.innerHTML=t:this.hintEl.innerHTML=t.map(n=>`<span class="h-item"><span class="key">${this.touch?n.touch:n.key}</span>${n.label}</span>`).join(""),this.hintEl.classList.add("on"),e&&this.later("hint",e*1e3,()=>this.hintEl.classList.remove("on"))}prompt(t){if(!t){this.promptEl.classList.remove("on");return}this.promptEl.innerHTML=`<span class="key">${this.touch?t.touch:t.key}</span><span>${t.label}</span>`,this.promptEl.classList.add("on")}counter(t){this.counterEl.classList.toggle("on",!!t),t&&(this.counterEl.innerHTML=t)}crosshair(t,e=0,n=!1,i=!0){if(this.crossEl.classList.toggle("on",t),!t)return;const s=this.crossEl.querySelector(".ring"),o=2*Math.PI*30;s.style.strokeDasharray=`${o*e} ${o}`,this.crossEl.classList.toggle("target",n),this.crossEl.classList.toggle("far",!i&&e>.2)}marker(t,e,n=""){if(!e){this.markerEl.classList.remove("on");return}const i=e.clone().project(t),s=i.z>1;let o=(i.x*.5+.5)*innerWidth,a=(-i.y*.5+.5)*innerHeight;s&&(o=innerWidth-o,a=innerHeight-60);const c=44,l=Math.min(innerWidth-c,Math.max(c,o)),h=Math.min(innerHeight-c-30,Math.max(c+40,a)),d=l!==o||h!==a||s;this.markerEl.style.transform=`translate(${l}px, ${h}px)`,this.markerEl.classList.add("on"),this.markerEl.classList.toggle("edge",d);const f=t.position.distanceTo(e);this.markerEl.querySelector(".mk-label").textContent=`${n}${n?" · ":""}${Math.round(f)} מ׳`}health(t,e=3,n=3){if(this.healthEl.classList.toggle("on",t),!t)return;let i="";for(let s=0;s<n;s++)i+=`<div class="hp ${s<e?"full":""}"></div>`;this.healthEl.innerHTML=i}boss(t,e=1){this.bossEl.classList.toggle("on",t),this.bossEl.querySelector(".boss-bar div").style.width=`${Math.max(0,e)*100}%`}qte(t,e=0,n="",i=null){if(!t){this.qteEl.className="qte";return}const s=i?`<span class="key">${this.touch?i.touch:i.key}</span>`:"";if(t==="mash")this.qteEl.innerHTML=`<div class="q-label">${n}</div><div class="q-mash"><div style="width:${e*100}%"></div></div><div class="q-key">${s}<span>${this.touch?"הקש שוב ושוב":"לחץ שוב ושוב"}</span></div>`;else if(t==="timing"){const o=1+e*2.2;this.qteEl.innerHTML=`<div class="q-label">${n}</div><div class="q-timing"><div class="q-target"></div><div class="q-ring" style="transform:translate(-50%,-50%) scale(${o})"></div>${s}</div>`}else this.qteEl.innerHTML=`<div class="q-label big">${n}</div><div class="q-key pulse">${s}</div>`;this.qteEl.className=`qte on ${t}`}flashQte(t){this.qteEl.classList.remove("ok","bad"),this.qteEl.offsetWidth,this.qteEl.classList.add(t?"ok":"bad")}toast(t,e,n=7){this.toastEl.innerHTML=`<div class="t-title">${t}</div><div class="t-body">${e}</div>`,this.toastEl.classList.remove("on"),this.toastEl.offsetWidth,this.toastEl.classList.add("on"),this.later("toast",n*1e3,()=>this.toastEl.classList.remove("on"))}fade(t,e=1){this.fadeEl.style.transition=`opacity ${e}s ease`,this.fadeEl.style.opacity=String(t)}hud(t){this.root.classList.toggle("hud-off",!t)}buildPause(){const t=this.touch?"<tr><td>ג׳ויסטיק (שמאל)</td><td>תנועה · דחיפה לקצה = ריצה</td></tr><tr><td>גרירה (ימין)</td><td>מצלמה</td></tr><tr><td>קֶלַע</td><td>החזק לסיבוב · שחרר לקליעה</td></tr><tr><td>מַקֵּל</td><td>הכאה במקל</td></tr><tr><td>פְּעֻלָּה</td><td>אסוף · הצל · תפוס</td></tr><tr><td>הִתְחַמֵּק</td><td>קפיצת התחמקות</td></tr><tr><td>קְרִיאָה</td><td>קריאה לצאן</td></tr>":'<tr><td><span class="key">W A S D</span></td><td>תנועה</td></tr><tr><td><span class="key">Shift</span></td><td>ריצה</td></tr><tr><td><span class="key">עכבר</span></td><td>מצלמה (לחץ על המסך לנעילת הסמן, או גרור עם העכבר)</td></tr><tr><td><span class="key">לחצן שמאלי</span></td><td>החזק לסיבוב הקלע · שחרר לקליעה</td></tr><tr><td><span class="key">F</span> / <span class="key">לחצן ימני</span></td><td>הכאה במקל</td></tr><tr><td><span class="key">E</span></td><td>פעולה: אסוף · הצל · תפוס</td></tr><tr><td><span class="key">Space</span></td><td>התחמקות</td></tr><tr><td><span class="key">Q</span></td><td>קריאה לצאן</td></tr><tr><td><span class="key">Esc</span></td><td>תפריט</td></tr>';this.pauseEl.innerHTML=`
      <div class="p-card">
        <div class="p-title">DAVID</div>
        <div class="p-sub">פרק ראשון · הרועה</div>
        <button class="p-btn" data-a="resume">המשך</button>
        <table class="p-keys">${t}</table>
        <label class="p-row">עוצמת קול <input type="range" min="0" max="1" step="0.05" value="0.9" data-a="vol"></label>
        <label class="p-row">רגישות מצלמה <input type="range" min="0.3" max="2" step="0.1" value="1" data-a="sens"></label>
        <button class="p-btn ghost" data-a="restart">התחל את הפרק מחדש</button>
      </div>`,this.pauseEl.querySelector('[data-a="resume"]').addEventListener("click",()=>this.onResume?.()),this.pauseEl.querySelector('[data-a="restart"]').addEventListener("click",()=>this.onRestart?.()),this.pauseEl.querySelector('[data-a="vol"]').addEventListener("input",e=>this.onVolume?.(Number(e.target.value))),this.pauseEl.querySelector('[data-a="sens"]').addEventListener("input",e=>this.onSensitivity?.(Number(e.target.value)))}pause(t){this.pauseEl.classList.toggle("on",t)}endCard(t,e,n){if(!t){this.endEl.classList.remove("on");return}this.endEl.innerHTML=`
      <div class="e-inner">
        <div class="e-small">סוֹף פֶּרֶק רִאשׁוֹן</div>
        <div class="e-title">הָרֹעֶה</div>
        <div class="e-verse">"${zs("s1_17_36_37_endcard")}"<span>${Io("s1_17_36_37_endcard")}</span></div>
        <div class="e-next"><div class="e-next-label">בַּפֶּרֶק הַבָּא</div><div class="e-next-title">הַמְּשִׁיחָה</div><div class="e-next-verse">"${zs("s1_16_1_fill_horn")}"<span>${Io("s1_16_1_fill_horn")}</span></div></div>
        <div class="e-btns"><button class="p-btn" data-a="free">המשך לשוטט בשדה</button><button class="p-btn ghost" data-a="replay">שחק שוב</button></div>
      </div>`,this.endEl.querySelector('[data-a="replay"]').addEventListener("click",()=>e?.()),this.endEl.querySelector('[data-a="free"]').addEventListener("click",()=>n?.()),this.endEl.classList.add("on")}}const Fe=Math.PI,Se=Math.PI*2,Oe=(r,t,e)=>r<t?t:r>e?e:r,Ut=(r,t,e)=>r+(t-r)*e,Pt=(r,t,e)=>{const n=Oe((e-r)/(t-r),0,1);return n*n*(3-2*n)},Ai=r=>(r=(r+Fe)%Se,r<0&&(r+=Se),r-Fe),An=(r,t,e,n)=>Ut(r,t,1-Math.exp(-e*n)),Su=(r,t,e)=>r<t?Math.min(t,r+e):Math.max(t,r-e);function B0(r){let t=r>>>0;return()=>{t=t+1831565813|0;let e=Math.imul(t^t>>>15,1|t);return e=e+Math.imul(e^e>>>7,61|e)^e,((e^e>>>14)>>>0)/4294967296}}function Bn(r,t,e,n){let i=Math.imul(r|0,668265261)^Math.imul(t|0,374761393)^Math.imul(e|0,2654435761)^Math.imul((n|0)+1663821227,2246822507);return i=Math.imul(i^i>>>15,739982445),i=Math.imul(i^i>>>12,695872825),i^=i>>>15,(i>>>0)/4294967296}function O0(r,t,e,n){const i=Math.floor(r),s=Math.floor(t),o=Math.floor(e),a=r-i,c=t-s,l=e-o,h=a*a*(3-2*a),d=c*c*(3-2*c),f=l*l*(3-2*l),u=Bn(i,s,o,n),m=Bn(i+1,s,o,n),v=Bn(i,s+1,o,n),p=Bn(i+1,s+1,o,n),g=Bn(i,s,o+1,n),x=Bn(i+1,s,o+1,n),_=Bn(i,s+1,o+1,n),y=Bn(i+1,s+1,o+1,n),w=Ut(u,m,h),T=Ut(v,p,h),R=Ut(g,x,h),E=Ut(_,y,h);return Ut(Ut(w,T,d),Ut(R,E,d),f)}const ec=[0,0];function Jx(r,t,e,n){const i=Math.floor(r),s=Math.floor(t),o=Math.floor(e);let a=9,c=9;for(let l=-1;l<=1;l++)for(let h=-1;h<=1;h++)for(let d=-1;d<=1;d++){const f=i+d,u=s+h,m=o+l,v=f+Bn(f,u,m,n)-r,p=u+Bn(f,u,m,n+17)-t,g=m+Bn(f,u,m,n+31)-e,x=v*v+p*p+g*g;x<a?(c=a,a=x):x<c&&(c=x)}return ec[0]=Math.sqrt(a),ec[1]=Math.sqrt(c),ec}function nn(r){const t=new dt(r);return[t.r,t.g,t.b]}function Fl(r,t,e,n,i){return r.b=[t,e,n,i],r}function Vt(r,t){const[e,n,i]=r,[s,o,a]=t,c=1/s,l=1/o,h=1/a,d=c*c,f=l*l,u=h*h,m=Math.min(s,o,a);return Fl((p,g,x)=>{const _=p-e,y=g-n,w=x-i,T=_*c,R=y*l,E=w*h,D=Math.sqrt(T*T+R*R+E*E),M=_*d,S=y*f,k=w*u,N=Math.sqrt(M*M+S*S+k*k);return N<1e-9?-m:D*(D-1)/N},e,n,i,Math.max(s,o,a))}function Bl(r,t,e,n,i){const o=new Dt().makeRotationFromEuler(new Ve(e,n,i)).invert().elements,a=Vt([0,0,0],t);return Fl((l,h,d)=>{const f=l-r[0],u=h-r[1],m=d-r[2];return a(o[0]*f+o[4]*u+o[8]*m,o[1]*f+o[5]*u+o[9]*m,o[2]*f+o[6]*u+o[10]*m)},r[0],r[1],r[2],Math.max(t[0],t[1],t[2]))}function Ae(r,t,e,n){const i=t[0]-r[0],s=t[1]-r[1],o=t[2]-r[2],a=i*i+s*s+o*o,c=e-n,l=a-c*c,h=1/a,d=Math.sign(c);return Fl((u,m,v)=>{const p=u-r[0],g=m-r[1],x=v-r[2],_=p*i+g*s+x*o,y=_-a,w=p*a-i*_,T=g*a-s*_,R=x*a-o*_,E=w*w+T*T+R*R,D=_*_*a,M=y*y*a,S=d*c*c*E;return Math.sign(y)*l*M>S?Math.sqrt(E+M)*h-n:Math.sign(_)*l*D<S?Math.sqrt(E+D)*h-e:(Math.sqrt(E*l*h)+_*c)*h-e},(r[0]+t[0])/2,(r[1]+t[1])/2,(r[2]+t[2])/2,Math.sqrt(a)/2+Math.max(e,n))}function wu(r,t,e){if(e<=0)return Math.min(r,t);const n=Math.max(e-Math.abs(r-t),0)/e;return Math.min(r,t)-n*n*e*.25}const tn=0,dn=1,Kn=2,Zn=3,jt=4,pi=5,Xs=6,js=7,Jn=8,Qx=9,rl=21,le=(r,t)=>Qx+r*3+t;function Ct(r){return(t,e,n,i,s)=>{i[r]+=s}}function oa(r,t,e){const n=t[0]-r[0],i=t[1]-r[1],s=t[2]-r[2],o=n*n+i*i+s*s;return(a,c,l,h,d)=>{const f=((a-r[0])*n+(c-r[1])*i+(l-r[2])*s)/o;if(f<=e[0][0]){h[e[0][1]]+=d;return}for(let u=0;u<e.length-1;u++){const[m,v]=e[u],[p,g]=e[u+1];if(f<=p){const x=Pt(0,1,(f-m)/(p-m));h[v]+=d*(1-x),h[g]+=d*x;return}}h[e[e.length-1][1]]+=d}}function aa(r){return(t,e,n)=>{let i=1e9;for(let s=0;s<r.length;s++){const o=r[s],a=o.f.b;if(a){const l=Math.sqrt((t-a[0])*(t-a[0])+(e-a[1])*(e-a[1])+(n-a[2])*(n-a[2]))-a[3];if(o.sub?l>o.k-i:l>i+o.k)continue}const c=o.f(t,e,n);o.sub?i=-wu(-i,c,o.k):i=wu(i,c,o.k)}return i}}const xo=[[0,0,0],[1,0,0],[0,1,0],[1,1,0],[0,0,1],[1,0,1],[0,1,1],[1,1,1]],Tu=[[0,1],[2,3],[4,5],[6,7],[0,2],[1,3],[4,6],[5,7],[0,4],[1,5],[2,6],[3,7]];function t_(r,t,e){const[n,i,s,o,a,c]=t,l=Math.ceil((o-n)/e)+1,h=Math.ceil((a-i)/e)+1,d=Math.ceil((c-s)/e)+1,f=new Float32Array(l*h*d),u=4,m=Math.ceil((l-1)/u),v=Math.ceil((h-1)/u),p=Math.ceil((d-1)/u),g=m+1,x=v+1,_=p+1,y=new Float32Array(g*x*_);for(let P=0;P<_;P++)for(let B=0;B<x;B++)for(let G=0;G<g;G++)y[G+g*(B+x*P)]=r(n+Math.min(G*u,l-1)*e,i+Math.min(B*u,h-1)*e,s+Math.min(P*u,d-1)*e);const w=u*e*1.3,T=[];for(let P=0;P<p;P++)for(let B=0;B<v;B++)for(let G=0;G<m;G++){let Q=1e9,ut=0;for(let ot=0;ot<8;ot++){const lt=xo[ot],bt=y[G+lt[0]+g*(B+lt[1]+x*(P+lt[2]))];Math.abs(bt)<Q&&(Q=Math.abs(bt)),ut+=bt}const X=Math.min(G*u+u,l-1),Z=Math.min(B*u+u,h-1),rt=Math.min(P*u+u,d-1);if(Q<w){T.push(G,B,P);continue}const J=ut<0?-Q:Q;for(let ot=P*u;ot<=rt;ot++)for(let lt=B*u;lt<=Z;lt++)for(let bt=G*u;bt<=X;bt++)f[bt+l*(lt+h*ot)]=J}const R=new Uint8Array(l*h*d);for(let P=0;P<T.length;P+=3){const B=T[P],G=T[P+1],Q=T[P+2],ut=Math.min(B*u+u,l-1),X=Math.min(G*u+u,h-1),Z=Math.min(Q*u+u,d-1);for(let rt=Q*u;rt<=Z;rt++)for(let J=G*u;J<=X;J++)for(let ot=B*u;ot<=ut;ot++){const lt=ot+l*(J+h*rt);R[lt]||(R[lt]=1,f[lt]=r(n+ot*e,i+J*e,s+rt*e))}}const E=l-1,D=h-1,M=d-1,S=new Int32Array(E*D*M).fill(-1),k=[],N=new Float32Array(8);for(let P=0;P<M;P++)for(let B=0;B<D;B++)for(let G=0;G<E;G++){let Q=0;for(let J=0;J<8;J++){const ot=xo[J],lt=f[G+ot[0]+l*(B+ot[1]+h*(P+ot[2]))];N[J]=lt,lt<0&&(Q|=1<<J)}if(Q===0||Q===255)continue;let ut=0,X=0,Z=0,rt=0;for(let J=0;J<12;J++){const ot=Tu[J][0],lt=Tu[J][1];if(N[ot]<0!=N[lt]<0){const bt=N[ot]/(N[ot]-N[lt]),At=xo[ot],st=xo[lt];ut+=At[0]+bt*(st[0]-At[0]),X+=At[1]+bt*(st[1]-At[1]),Z+=At[2]+bt*(st[2]-At[2]),rt++}}S[G+E*(B+D*P)]=k.length/3,k.push(n+(G+ut/rt)*e,i+(B+X/rt)*e,s+(P+Z/rt)*e)}const z=[],H=(P,B,G)=>S[P+E*(B+D*G)],L=(P,B,G,Q,ut)=>{if(P<0||B<0||G<0||Q<0)return;if(ut){const rt=B;B=Q,Q=rt}const X=Eu(k,P,G),Z=Eu(k,B,Q);X<=Z?z.push(P,B,G,P,G,Q):z.push(P,B,Q,B,G,Q)};for(let P=0;P<d;P++)for(let B=0;B<h;B++)for(let G=0;G<l;G++){const Q=f[G+l*(B+h*P)]<0;if(G<E&&B>0&&P>0&&B<D&&P<M){const ut=f[G+1+l*(B+h*P)]<0;Q!==ut&&L(H(G,B-1,P-1),H(G,B,P-1),H(G,B,P),H(G,B-1,P),!Q)}if(B<D&&G>0&&P>0&&G<E&&P<M){const ut=f[G+l*(B+1+h*P)]<0;Q!==ut&&L(H(G-1,B,P-1),H(G-1,B,P),H(G,B,P),H(G,B,P-1),!Q)}if(P<M&&G>0&&B>0&&G<E&&B<D){const ut=f[G+l*(B+h*(P+1))]<0;Q!==ut&&L(H(G-1,B-1,P),H(G,B-1,P),H(G,B,P),H(G-1,B,P),!Q)}}const V=new Array(k.length).fill(0),O=e*.3;for(let P=0;P<k.length;P+=3){let B=k[P],G=k[P+1],Q=k[P+2],ut=0,X=1,Z=0;for(let rt=0;rt<3;rt++){const J=r(B+O,G-O,Q-O),ot=r(B-O,G-O,Q+O),lt=r(B-O,G+O,Q-O),bt=r(B+O,G+O,Q+O),At=(J+ot+lt+bt)*.25;ut=J-ot-lt+bt,X=-J-ot+lt+bt,Z=-J+ot-lt+bt;const st=Math.hypot(ut,X,Z)||1;if(ut/=st,X/=st,Z/=st,rt<2){const F=Oe(At,-e*.6,e*.6);B-=ut*F,G-=X*F,Q-=Z*F}}k[P]=B,k[P+1]=G,k[P+2]=Q,V[P]=ut,V[P+1]=X,V[P+2]=Z}return{pos:k,nrm:V,tris:z}}function Eu(r,t,e){const n=r[t*3]-r[e*3],i=r[t*3+1]-r[e*3+1],s=r[t*3+2]-r[e*3+2];return n*n+i*i+s*s}const pn=()=>({r:1,g:1,b:1,wool:0,tint:1,rough:.8,thin:0,fur:0,horn:0,streak:0,ao:1,fx:0,fy:-1,fz:0});class Ys{constructor(){b(this,"p",[]);b(this,"n",[]);b(this,"c",[]);b(this,"si",[]);b(this,"sw",[]);b(this,"m",[]);b(this,"a",[]);b(this,"f",[]);b(this,"idx",[]);b(this,"acc",new Float32Array(rl))}get count(){return this.p.length/3}vert(t,e,n,i,s,o,a,c){this.p.push(t,e,n);const l=Math.hypot(i,s,o)||1;this.n.push(i/l,s/l,o/l),this.c.push(a.r,a.g,a.b),this.m.push(a.wool,a.tint,a.rough,a.thin),this.a.push(a.horn,a.fur,a.streak,a.ao);const h=Math.hypot(a.fx,a.fy,a.fz)||1;this.f.push(a.fx/h,a.fy/h,a.fz/h);const d=[0,0,0,0],f=[0,0,0,0];for(let m=0;m<rl;m++){const v=c[m];if(v<=0)continue;let p=-1;for(let g=0;g<4;g++)if(v>f[g]){p=g;break}if(!(p<0)){for(let g=3;g>p;g--)f[g]=f[g-1],d[g]=d[g-1];f[p]=v,d[p]=m}}let u=f[0]+f[1]+f[2]+f[3];return u<=0&&(f[0]=1,d[0]=tn,u=1),this.si.push(d[0],d[1],d[2],d[3]),this.sw.push(f[0]/u,f[1]/u,f[2]/u,f[3]/u),this.count-1}weights1(t){return this.acc.fill(0),this.acc[t]=1,this.acc}weights2(t,e,n){return this.acc.fill(0),this.acc[t]+=1-n,this.acc[e]+=n,this.acc}weights3(t,e,n,i,s,o){return this.acc.fill(0),this.acc[t]+=e,this.acc[n]+=i,this.acc[s]+=o,this.acc}recomputeNormals(t,e,n,i){const{p:s,n:o,idx:a}=this;for(let c=t*3;c<e*3;c++)o[c]=0;for(let c=n;c<i;c+=3){const l=a[c],h=a[c+1],d=a[c+2],f=s[l*3],u=s[l*3+1],m=s[l*3+2],v=s[h*3]-f,p=s[h*3+1]-u,g=s[h*3+2]-m,x=s[d*3]-f,_=s[d*3+1]-u,y=s[d*3+2]-m,w=p*y-g*_,T=g*x-v*y,R=v*_-p*x;for(const E of[l,h,d])E<t||E>=e||(o[E*3]+=w,o[E*3+1]+=T,o[E*3+2]+=R)}for(let c=t;c<e;c++){const l=Math.hypot(o[c*3],o[c*3+1],o[c*3+2])||1;o[c*3]/=l,o[c*3+1]/=l,o[c*3+2]/=l}}triOut(t,e,n,i,s,o){const a=this.p,c=a[t*3],l=a[t*3+1],h=a[t*3+2],d=a[e*3]-c,f=a[e*3+1]-l,u=a[e*3+2]-h,m=a[n*3]-c,v=a[n*3+1]-l,p=a[n*3+2]-h,g=f*p-u*v,x=u*m-d*p,_=d*v-f*m,y=(c+a[e*3]+a[n*3])/3-i,w=(l+a[e*3+1]+a[n*3+1])/3-s,T=(h+a[e*3+2]+a[n*3+2])/3-o;g*y+x*w+_*T>=0?this.idx.push(t,e,n):this.idx.push(t,n,e)}build(){const t=new ge;return t.setAttribute("position",new $t(this.p,3)),t.setAttribute("normal",new $t(this.n,3)),t.setAttribute("color",new $t(this.c,3)),t.setAttribute("skinIndex",new bl(this.si,4)),t.setAttribute("skinWeight",new $t(this.sw,4)),t.setAttribute("aMat",new $t(this.m,4)),t.setAttribute("aAux",new $t(this.a,4)),t.setAttribute("aFlow",new $t(this.f,3)),t.setIndex(this.idx),t}buildShells(t){const e=new Map,n=[];for(let u=0;u<this.idx.length;u+=3){const m=this.idx[u],v=this.idx[u+1],p=this.idx[u+2];if(!(this.a[m*4+1]<=0||this.a[v*4+1]<=0||this.a[p*4+1]<=0))for(const g of[m,v,p]){let x=e.get(g);x===void 0&&(x=e.size,e.set(g,x)),n.push(x)}}const i=e.size;if(i===0)return null;const s=new Float32Array(i*3*t),o=new Float32Array(i*3*t),a=new Float32Array(i*3*t),c=new Uint16Array(i*4*t),l=new Float32Array(i*4*t),h=new Float32Array(i*4*t),d=new Uint32Array(n.length*t);e.forEach((u,m)=>{for(let v=0;v<t;v++){const p=v*i+u;for(let g=0;g<3;g++)s[p*3+g]=this.p[m*3+g],o[p*3+g]=this.n[m*3+g],a[p*3+g]=this.a[m*4+3];for(let g=0;g<4;g++)c[p*4+g]=this.si[m*4+g],l[p*4+g]=this.sw[m*4+g];h[p*4]=(v+1)/t,h[p*4+1]=this.a[m*4+1],h[p*4+2]=this.m[m*4],h[p*4+3]=this.a[m*4+2]}});for(let u=0;u<t;u++)for(let m=0;m<n.length;m++)d[u*n.length+m]=n[m]+u*i;const f=new ge;return f.setAttribute("position",new te(s,3)),f.setAttribute("normal",new te(o,3)),f.setAttribute("color",new te(a,3)),f.setAttribute("skinIndex",new te(c,4)),f.setAttribute("skinWeight",new te(l,4)),f.setAttribute("aShell",new te(h,4)),f.setIndex(new te(d,1)),f}}function $s(r,t,e,n){Au(r,t,t.res),e&&Au(e,t,n??t.res)}function Au(r,t,e){const n=aa(t.parts),i=t_(n,t.box,e),s=t.xf??new Dt,o=new Qt().getNormalMatrix(s),a=new A,c=new A,l=new Float32Array(rl),h=pn(),d=r.count,f=r.idx.length,u=t.parts.filter(m=>!m.sub&&m.w);for(let m=0;m<i.pos.length;m+=3){const v=i.pos[m],p=i.pos[m+1],g=i.pos[m+2];a.set(v,p,g).applyMatrix4(s),c.set(i.nrm[m],i.nrm[m+1],i.nrm[m+2]).applyMatrix3(o).normalize(),l.fill(0);for(const x of u){const _=x.f(v,p,g),y=Math.exp(-Math.max(_,0)/(x.sigma??t.sigma));x.w(v,p,g,l,y)}if(Object.assign(h,pn()),t.flow&&(h.fx=t.flow[0],h.fy=t.flow[1],h.fz=t.flow[2]),t.paint(a.x,a.y,a.z,v,p,g,h),t.lumps&&h.wool>0){const x=t.lumps,_=Jx(a.x/x.cell,a.y/x.cell*x.stretch,a.z/x.cell,x.seed),y=Oe((_[1]-_[0])*1.8,0,1),w=Math.sqrt(y),T=O0(a.x*40,a.y*40,a.z*40,x.seed+5),R=x.amp*(w*.85+T*.35-.45)*h.wool;a.addScaledVector(c,R);const E=Ut(1-x.ao,1,w*.8+T*.2);h.ao*=Ut(1,E,Math.min(1,h.wool*4)),h.fur*=.55+.6*w}r.vert(a.x,a.y,a.z,c.x,c.y,c.z,h,l)}for(let m=0;m<i.tris.length;m++)r.idx.push(i.tris[m]+d);t.lumps&&r.recomputeNormals(d,r.count,f,r.idx.length)}function Dr(r,t,e,n,i,s,o,a,c){const l=[t.hip,t.knee,t.fetlock,t.hoof],h=R=>{for(let E=0;E<3;E++){const D=l[E],M=l[E+1];if(R<=D[1]+1e-6&&R>=M[1]-1e-6){const S=(D[1]-R)/(D[1]-M[1]);return[Ut(D[0],M[0],S),R,Ut(D[2],M[2],S)]}}return R>l[0][1]?[l[0][0],R,l[0][2]]:[l[3][0],R,l[3][2]]},d=[];for(let R=0;R<n.length-1;R++){const E=n[R],D=n[R+1],M=Math.max(1,Math.ceil((E[0]-D[0])/.018));for(let S=0;S<M;S++){const k=S/M,N=k*k*(3-2*k)*.5+k*.5;d.push([Ut(E[0],D[0],k),Ut(E[1],D[1],N),Ut(E[2],D[2],N),Ut(E[3],D[3],N)])}}d.push(n[n.length-1]);const f=12,u=r.count,m=r.idx.length,v=pn(),p=t.knee[1],g=t.fetlock[1],x=[];for(let R=0;R<d.length;R++){const[E,D,M,S]=d[R],k=h(E),N=h(E+.01),z=h(E-.01);let H=z[0]-N[0],L=z[1]-N[1],V=z[2]-N[2];const O=Math.hypot(H,L,V)||1;H/=O,L/=O,V/=O;const P=0,B=V,G=-L,Q=Math.hypot(B,G)||1,ut=Pt(p-.022,p+.022,E),X=1-Pt(g-.014,g+.014,E),Z=Math.max(0,1-ut-X),rt=E<i;x.push(r.count);for(let J=0;J<f;J++){const ot=J/f*Se;let lt=D,bt=M;const At=Math.cos(ot),st=Math.sin(ot);if(rt){const mt=Math.exp(-(ot*ot)/.05)+Math.exp(-((ot-Se)*(ot-Se))/.05);bt*=1-.28*mt}else if(E<g+.02&&E>i){const mt=Math.exp(-((ot-Fe)*(ot-Fe))/.12);bt*=1+.18*mt*Pt(i,g,E)}const F=st*lt,Gt=At*bt,Lt=k[0]+F+P*Gt,vt=k[1]+B/Q*Gt,ft=k[2]+S+G/Q*Gt;if(Object.assign(v,pn()),rt){const mt=Pt(i-.012,i,E);v.r=Ut(s[0],.08,mt*.25),v.g=Ut(s[1],.07,mt*.25),v.b=Ut(s[2],.06,mt*.25),v.tint=0,v.rough=.62}else v.ao=Ut(o,1,Pt(t.hip[1]-.02,t.hip[1]-.16,E)),v.tint=1,v.rough=.75,v.streak=.4,v.fur=c,a>0&&(v.fur=Math.max(c,a*Pt(t.hip[1]-.2,t.hip[1]-.08,E)));const Kt=r.weights3(le(e,0),ut,le(e,1),Z,le(e,2),X);r.vert(Lt,vt,ft,st,B/Q*At,G/Q*At,v,Kt)}}for(let R=0;R<d.length-1;R++){const E=x[R],D=x[R+1],M=d[R][0],S=h(M);for(let k=0;k<f;k++){const N=(k+1)%f;r.triOut(E+k,D+k,D+N,S[0],S[1]-.005,S[2]),r.triOut(E+k,D+N,E+N,S[0],S[1]-.005,S[2])}}const _=x[x.length-1],y=h(0),w=pn();w.r=s[0]*.7,w.g=s[1]*.7,w.b=s[2]*.7,w.tint=0,w.rough=.6;const T=r.vert(y[0],0,y[2]+d[d.length-1][3],0,-1,0,w,r.weights1(le(e,2)));for(let R=0;R<f;R++)r.triOut(_+R,_+(R+1)%f,T,y[0],.05,y[2]);r.recomputeNormals(u,r.count,m,r.idx.length)}function Ol(r,t,e,n){const i=new A(...t.base).applyMatrix4(e),s=new A(...t.dir).normalize();let o=new A(...t.inner);o.addScaledVector(s,-o.dot(s)).normalize();const a=new A().crossVectors(s,o).normalize(),c=16,l=14,h=r.count,d=r.idx.length,f=pn(),u=[],m=[];for(let x=0;x<=c;x++){const _=x/c,y=t.width*(.3*(1-_)+.85*Math.pow(Math.sin(Fe*Math.pow(_,.75)),.8))+.001,w=t.thick*(1-.55*_)+.0015,T=t.cup*t.width*Math.sin(Fe*Math.min(1,_*1.1))*.9,R=(t.curlTip??0)*Pt(.55,1,_),E=i.clone().addScaledVector(s,_*t.length).addScaledVector(o,-R*t.length*.35*_);m.push(E),u.push(r.count);const D=Pt(0,.22,_),M=r.weights2(jt,n,D);for(let S=0;S<l;S++){const k=S/l*Se,N=Math.cos(k),z=Math.sin(k),H=E.x+a.x*y*N+o.x*(w*z+T*N*N),L=E.y+a.y*y*N+o.y*(w*z+T*N*N),V=E.z+a.z*y*N+o.z*(w*z+T*N*N);Object.assign(f,pn());const O=Pt(-.1,.5,-z)*(1-Pt(.75,.95,Math.abs(N)));f.r=t.innerColor[0],f.g=t.innerColor[1],f.b=t.innerColor[2],f.tint=1-O,f.rough=.8,f.thin=1,f.fur=(t.fur??0)*(1-O)*Pt(.1,.3,_),f.streak=.7,f.fx=s.x,f.fy=s.y,f.fz=s.z,r.vert(H,L,V,0,1,0,f,M)}}for(let x=0;x<c;x++){const _=u[x],y=u[x+1],w=m[x];for(let T=0;T<l;T++){const R=(T+1)%l;r.triOut(_+T,y+T,y+R,w.x,w.y,w.z),r.triOut(_+T,y+R,_+R,w.x,w.y,w.z)}}const v=u[c],p=m[c].clone().addScaledVector(s,.004),g=r.vert(p.x,p.y,p.z,s.x,s.y,s.z,{...pn(),thin:1},r.weights1(n));for(let x=0;x<l;x++)r.triOut(v+x,v+(x+1)%l,g,m[c-1].x,m[c-1].y,m[c-1].z);r.recomputeNormals(h,r.count,d,r.idx.length)}function Hl(r,t,e){const n=new Qt().getNormalMatrix(e),i=nn(t.iris),s=nn(3811871);for(const o of[1,-1]){const a=new A(t.dir[0]*o,t.dir[1],t.dir[2]).normalize(),c=new A(t.c[0]*o,t.c[1],t.c[2]);let l=0;for(let E=0;E<400;E++){const D=c.clone().addScaledVector(a,l);if(t.sdf(D.x,D.y,D.z)>0)break;l+=5e-4}const h=c.clone().addScaledVector(a,l-t.r*(1-t.protrude)),d=new A(0,1,0),f=new A().crossVectors(d,a).normalize();d.crossVectors(a,f).normalize();const u=24,m=18,v=r.count,p=pn(),g=r.weights1(jt);for(let E=0;E<=m;E++){const D=E/m*Fe;for(let M=0;M<u;M++){const S=M/u*Se,k=new A().copy(a).multiplyScalar(Math.cos(D)).addScaledVector(f,Math.sin(D)*Math.cos(S)).addScaledVector(d,Math.sin(D)*Math.sin(S)),N=h.clone().addScaledVector(k,t.r).applyMatrix4(e),z=k.clone().applyMatrix3(n).normalize(),H=Math.cos(D),L=Math.sin(D)*Math.cos(S),V=Math.sin(D)*Math.sin(S),O=(L/t.pupil[0])**2+(V/t.pupil[1])**2;Object.assign(p,pn());const P=Pt(1-t.irisSize-.05,1-t.irisSize+.03,H),B=1-Pt(.75,1.15,O),G=Pt(1-t.irisSize+.12,1-t.irisSize+.02,H)*.5,Q=.85+.3*O0(Math.cos(S)*3+10,Math.sin(S)*3,H*8,3),ut=(.7+.3*H)*Q*(1-G);p.r=Ut(Ut(s[0],i[0]*ut,P),.003,B*P),p.g=Ut(Ut(s[1],i[1]*ut,P),.003,B*P),p.b=Ut(Ut(s[2],i[2]*ut,P),.003,B*P),p.tint=0,p.rough=.05,r.vert(N.x,N.y,N.z,z.x,z.y,z.z,p,g)}}const x=h.clone().applyMatrix4(e);for(let E=0;E<m;E++)for(let D=0;D<u;D++){const M=v+E*u+D,S=v+(E+1)*u+D,k=v+E*u+(D+1)%u,N=v+(E+1)*u+(D+1)%u;r.triOut(M,S,N,x.x,x.y,x.z),r.triOut(M,N,k,x.x,x.y,x.z)}const _=28,y=8,w=r.count,T=r.idx.length,R=[];for(let E=0;E<_;E++){const D=E/_*Se,M=Math.sin(D),S=t.r*(.93-.12*t.lid*Math.max(0,M)),k=t.r*(.15+.13*Math.max(0,M)*(.5+t.lid)),N=new A().addScaledVector(f,Math.cos(D)).addScaledVector(d,M*.78),z=t.r*(.2+.1*t.lid*Math.max(0,M)),H=h.clone().addScaledVector(N,S).addScaledVector(a,z-t.r*.05);R.push(H);for(let L=0;L<y;L++){const V=L/y*Se,O=N.clone().normalize(),P=H.clone().addScaledVector(O,Math.cos(V)*k).addScaledVector(a,Math.sin(V)*k).applyMatrix4(e);Object.assign(p,pn());const B=Pt(.5,-.5,Math.cos(V))*Pt(-.8,.3,Math.sin(V)),G=nn(2365462);p.r=G[0],p.g=G[1],p.b=G[2],p.tint=1-B,p.ao=.8,p.rough=Ut(.7,.35,B),p.streak=.2,r.vert(P.x,P.y,P.z,0,1,0,p,g)}}for(let E=0;E<_;E++){const D=(E+1)%_,M=R[E].clone().add(R[D]).multiplyScalar(.5).applyMatrix4(e);for(let S=0;S<y;S++){const k=(S+1)%y;r.triOut(w+E*y+S,w+D*y+S,w+D*y+k,M.x,M.y,M.z),r.triOut(w+E*y+S,w+D*y+k,w+E*y+k,M.x,M.y,M.z)}}r.recomputeNormals(w,r.count,T,r.idx.length)}}function H0(r,t,e,n,i,s,o,a,c){const l=r.count,h=r.idx.length,d=[],f=[];let u=0,m=t(0);const v=pn();let p=o.clone();for(let y=0;y<=i;y++){const w=y/i,T=t(w);y>0&&(u+=T.distanceTo(m)),m=T;const R=t(Math.min(1,w+.01)).sub(t(Math.max(0,w-.01))).normalize(),E=p.clone().addScaledVector(R,-p.dot(R)).normalize();p=E;const D=new A().crossVectors(R,E).normalize();d.push(r.count),f.push(T);const M=e(w);for(let S=0;S<s;S++){const k=S/s*Se,[N,z]=n(k,w),H=T.clone().addScaledVector(E,Math.cos(k)*M*N).addScaledVector(D,Math.sin(k)*M*z);Object.assign(v,pn()),a(w,u,v),r.vert(H.x,H.y,H.z,0,1,0,v,r.weights1(c))}}for(let y=0;y<i;y++){const w=f[y].clone().add(f[y+1]).multiplyScalar(.5);for(let T=0;T<s;T++){const R=(T+1)%s;r.triOut(d[y]+T,d[y+1]+T,d[y+1]+R,w.x,w.y,w.z),r.triOut(d[y]+T,d[y+1]+R,d[y]+R,w.x,w.y,w.z)}}const g=t(1).add(t(1).sub(t(.98)).multiplyScalar(.5));Object.assign(v,pn()),a(1,u,v);const x=r.vert(g.x,g.y,g.z,0,1,0,v,r.weights1(c)),_=f[i];for(let y=0;y<s;y++)r.triOut(d[i]+y,d[i]+(y+1)%s,x,_.x-(g.x-_.x),_.y-(g.y-_.y),_.z-(g.z-_.z));r.recomputeNormals(l,r.count,h,r.idx.length)}function Vl(r,t){return new Dt().makeTranslation(r[0],r[1],r[2]).multiply(new Dt().makeRotationX(t))}function Gl(r,t,e,n,i){return(1-Pt(.0015,.005,Math.abs(r-e)))*Pt(n,n+.02,t)*(1-Pt(i-.01,i,t))}const mi=nn(2757907);function Wl(r){const t=new A(0,.25,-1).transformDirection(r);return[t.x,t.y,t.z]}function ql(r,t,e,n,i,s,o,a){const c=r.clone().invert(),l=h=>{const d=new A(h[0],h[1],h[2]).applyMatrix4(c);return[d.x,d.y,d.z]};return{f:Ae(l(t),l(e),n,i),k:a,w:oa(l(s),l(o),[[-.25,tn],[.15,Kn],[.6,Zn],[1,jt]]),sigma:.04}}function Ru(r,t){const e=r==="ram",n=e?1.1:1,i=(M,S,k)=>[M*n,S*n,k*n],s=e?.62:.72,o={body:i(0,.56,0),neck1:i(0,.58,.36),neck2:i(0,.7,.47),poll:i(0,.82,.575),headTilt:s,jaw:i(0,-.045,.03),earL:i(.045,.02,.014),earR:i(-.045,.02,.014),tail:i(0,.58,-.5),legs:[{hip:i(.095,.52,.27),knee:i(.095,.26,.275),fetlock:i(.095,.075,.28),hoof:i(.095,0,.3),front:!0},{hip:i(-.095,.52,.27),knee:i(-.095,.26,.275),fetlock:i(-.095,.075,.28),hoof:i(-.095,0,.3),front:!0},{hip:i(.1,.54,-.3),knee:i(.1,.29,-.39),fetlock:i(.1,.075,-.365),hoof:i(.1,0,-.345),front:!1},{hip:i(-.1,.54,-.3),knee:i(-.1,.29,-.39),fetlock:i(-.1,.075,-.365),hoof:i(-.1,0,-.345),front:!1}],grip:i(0,.79,.14),center:i(0,.56,0),muzzle:i(0,-.035,.235),headXf:new Dt,scale:n,earDir:[.45,-.85,.05]};o.headXf=Vl(o.poll,s);const a=new Ys,c=new Ys,l=i(0,.58,.33),h=i(0,.735,.49),d=i(0,.8,.56),f=(e?.16:.14)*n,u=(e?.085:.068)*n,m=[{f:Vt(i(0,.575,.19),i(.225,.21,.3)),k:0,w:Ct(dn)},{f:Vt(i(0,.585,-.2),i(.235,.205,.3)),k:.12*n,w:Ct(dn)},{f:Vt(i(0,.52,0),i(.215,.17,.34)),k:.12*n,w:Ct(dn)},{f:Vt(i(0,.5,.33),i(.15,.13,.12)),k:.08*n,w:Ct(dn)},{f:Ae(l,h,f,u),k:.1*n,w:oa(l,d,[[-.25,tn],[.15,Kn],[.6,Zn],[1,jt]]),sigma:.05},{f:Ae(i(.105,.5,.27),i(.1,.37,.28),.075*n,.05*n),k:.06*n,w:Ct(le(0,0)),sigma:.02},{f:Ae(i(-.105,.5,.27),i(-.1,.37,.28),.075*n,.05*n),k:.06*n,w:Ct(le(1,0)),sigma:.02},{f:Ae(i(.11,.52,-.3),i(.105,.37,-.37),.1*n,.058*n),k:.07*n,w:Ct(le(2,0)),sigma:.02},{f:Ae(i(-.11,.52,-.3),i(-.105,.37,-.37),.1*n,.058*n),k:.07*n,w:Ct(le(3,0)),sigma:.02},{f:Vt(i(0,.54,-.53),i(.13,.08,.08)),k:.06*n,w:Ct(Jn),sigma:.03},{f:Vt(i(0,.43,-.585),i(e?.165:.15,.165,.1)),k:.07*n,w:Ct(Jn),sigma:.03},{f:Vt(i(0,.28,-.6),i(.032,.05,.03)),k:.05*n,w:Ct(Jn),sigma:.025}];$s(a,{parts:m,box:[-.36*n,.18*n,-.76*n,.36*n,.9*n,.68*n],res:.018*n,sigma:.035,lumps:{amp:.024*n,cell:.056*n,stretch:.48,seed:t+11,ao:.5},paint:(M,S,k,N,z,H,L)=>{L.tint=1,L.rough=.95,L.thin=.55,L.fur=(.028+.016*Pt(.58*n,.4*n,S))*n;const V=Math.abs(M)>.05*n&&k>-.46*n?Pt(.35*n,.43*n,S):1,O=((k-l[2])*.69+(S-l[1])*.72)/n,P=1-Pt(.15,.21,O);L.wool=Math.min(V,P),L.fur*=Math.min(1,L.wool*1.2)*(1-Pt(.12,.2,O)*.7),L.streak=1-L.wool,L.rough=Ut(.7,.95,L.wool),k<-.5*n&&(L.fur*=Pt(.26*n,.34*n,S))}},c,.026*n);const v=o.headXf,p=M=>({f:Bl(i(.012*M,-.014,.248),i(.005,.0035,.011),.5,.45*M,.55*M),k:.005*n,sub:!0}),g=[{f:Vt(i(0,-.005,.035),i(.058,.056,.068)),k:0,w:Ct(jt)},{f:Vt(i(0,.02,.07),i(.05,.03,.05)),k:.03*n,w:Ct(jt)},{f:Ae(i(0,.016,.075),i(0,.003,.205),.038*n,.024*n),k:.035*n,w:Ct(jt)},{f:Vt(i(0,.022,.135),i(.028,.025,.07)),k:.035*n,w:Ct(jt)},{f:Vt(i(0,-.012,.14),i(.031,.038,.075)),k:.03*n,w:Ct(jt)},{f:Vt(i(.032,-.032,.062),i(.026,.036,.05)),k:.025*n,w:Ct(jt)},{f:Vt(i(-.032,-.032,.062),i(.026,.036,.05)),k:.025*n,w:Ct(jt)},{f:Vt(i(0,-.02,.218),i(.025,.028,.034)),k:.028*n,w:Ct(jt)},{f:Vt(i(0,-.041,.224),i(.022,.012,.027)),k:.012*n,w:Ct(jt)},{f:Ae(i(0,-.05,.04),i(0,-.054,.205),.03*n,.015*n),k:.018*n,w:Ct(pi),sigma:.008},{f:Vt(i(.038,.016,.083),i(.019,.015,.024)),k:.018*n,w:Ct(jt)},{f:Vt(i(-.038,.016,.083),i(.019,.015,.024)),k:.018*n,w:Ct(jt)},ql(v,i(0,.65,.42),i(0,.8,.565),(e?.105:.088)*n,(e?.062:.05)*n,l,d,.05*n),p(1),p(-1),{f:Vt(i(.042,-.005,.125),i(.012,.016,.03)),k:.018*n,sub:!0},{f:Vt(i(-.042,-.005,.125),i(.012,.016,.03)),k:.018*n,sub:!0},{f:Vt(i(0,-.035,.25),i(.0025,.014,.008)),k:.004*n,sub:!0},{f:Vt(i(0,-.0525,.205),i(.025,.0025,.045)),k:.004*n,sub:!0}],x=nn(2760989);$s(a,{parts:g,box:[-.12*n,-.33*n,-.14*n,.12*n,.1*n,.28*n],res:.006*n,xf:v,flow:Wl(v),sigma:.015,paint:(M,S,k,N,z,H,L)=>{L.tint=1,L.rough=.7,L.streak=.35;const V=Pt(.228*n,.245*n,H)*Pt(-.045*n,-.03*n,z),O=Pt(.195*n,.225*n,H)*(1-Pt(-.058*n,-.047*n,z))*.7,P=Math.max(V,O);L.r=x[0],L.g=x[1],L.b=x[2],L.tint=1-P,L.rough=Ut(.72,.35,V),L.ao=1-.35*Pt(-.03*n,-.07*n,z)*Pt(.02*n,.1*n,H);const B=Math.hypot(Math.abs(N)-.047*n,z-.012*n,H-.09*n);L.ao*=Ut(.72,1,Pt(.012*n,.035*n,B)),L.ao*=1+.14*Pt(.012*n,.03*n,z)*Pt(.09*n,.16*n,H)*(1-Pt(.2*n,.23*n,H)),L.streak=.8*(1-P);const G=Gl(z,H,-.0525*n,.15*n,.25*n);G>0&&(L.r=Ut(L.r,mi[0],G),L.g=Ut(L.g,mi[1],G),L.b=Ut(L.b,mi[2],G),L.tint*=1-G);const Q=Pt(-.05*n,-.1*n,z)*(1-Pt(0,.05*n,H));Q>0&&(L.fx=Ut(L.fx,0,Q),L.fy=Ut(L.fy,-.72,Q),L.fz=Ut(L.fz,-.69,Q))}}),Hl(a,{c:i(.02,.012,.09),r:.0135*n,dir:[.82,.22,.48],iris:11041334,irisSize:.36,pupil:[.22,.085],protrude:.45,sdf:aa(g),lid:.5},v);const _=nn(8019794);for(const M of[1,-1])Ol(a,{base:[o.earL[0]*M,o.earL[1],o.earL[2]],dir:[.42*M,-.9,.1],inner:[-.9*M,-.1,.35],length:.17*n,width:.042*n,thick:.0045*n,cup:.3,innerColor:_},v,M>0?Xs:js);e&&e_(a,v,n);const y=[[.52,.045,.05,0],[.4,.036,.043,0],[.33,.028,.034,0],[.29,.023,.028,0],[.265,.026,.029,.002],[.24,.02,.023,0],[.18,.016,.019,0],[.11,.0165,.019,0],[.082,.019,.022,0],[.062,.0172,.0198,.002],[.045,.0182,.0208,.004],[.02,.021,.025,.006],[.003,.0225,.0275,.007]],w=[[.54,.05,.07,0],[.45,.045,.064,0],[.38,.034,.05,-.004],[.32,.025,.036,-.008],[.29,.022,.032,-.01],[.26,.019,.024,-.004],[.18,.016,.019,0],[.11,.0165,.019,0],[.082,.019,.022,0],[.062,.0172,.0198,.002],[.045,.0182,.0208,.004],[.02,.021,.025,.006],[.003,.0225,.0275,.007]],T=M=>M.map(([S,k,N,z])=>[S*n,k*n*(e?1.08:1),N*n*(e?1.08:1),z*n]),R=nn(1906966);for(let M=0;M<4;M++)Dr(a,o.legs[M],M,T(M<2?y:w),.046*n,R,.5,0,0);const E=a.build(),D=c.buildShells(5);return{kind:r,rig:o,geometry:E,shells:D,radius:1*n,height:.9*n}}function e_(r,t,e){const n=nn(12034950),i=nn(7233614);for(const s of[1,-1]){const o=new A(.07*s*e,-.012*e,-.01*e),a=new A(0,1,0),c=new A(0,0,-1),l=new A(s,0,0),h=5.1;H0(r,f=>{const u=f*h-.3,m=.05*e*Math.exp(.16*(u+.3));return o.clone().addScaledVector(a,Math.cos(u)*m).addScaledVector(c,Math.sin(u)*m).addScaledVector(l,(.005+.1*Math.pow(f,1.3))*e).applyMatrix4(t)},f=>(.043*Math.pow(1-f,.9)+.005)*e,f=>[1+.14*Math.cos(3*f),1+.14*Math.cos(3*f)],72,14,new A(s,0,0),(f,u,m)=>{const v=Pt(0,.35,f);m.r=Ut(i[0],n[0],v),m.g=Ut(i[1],n[1],v),m.b=Ut(i[2],n[2],v),m.tint=0,m.rough=.5,m.horn=u+1},jt)}}function n_(r){const e={body:[0,.335,0],neck1:[0,.37,.16],neck2:[0,.42,.21],poll:[0,.49,.26],headTilt:.62,jaw:[0,-.03,.02],earL:[.042,.03,0],earR:[-.042,.03,0],tail:[0,.38,-.26],legs:[{hip:[.06,.31,.15],knee:[.06,.155,.152],fetlock:[.06,.05,.155],hoof:[.06,0,.17],front:!0},{hip:[-.06,.31,.15],knee:[-.06,.155,.152],fetlock:[-.06,.05,.155],hoof:[-.06,0,.17],front:!0},{hip:[.065,.33,-.15],knee:[.065,.175,-.2],fetlock:[.065,.05,-.185],hoof:[.065,0,-.172],front:!1},{hip:[-.065,.33,-.15],knee:[-.065,.175,-.2],fetlock:[-.065,.05,-.185],hoof:[-.065,0,-.172],front:!1}],grip:[0,.465,.07],center:[0,.335,0],muzzle:[0,-.025,.14],headXf:new Dt,scale:.6,earDir:[.7,-.5,-.2]};e.headXf=Vl(e.poll,.62);const n=new Ys,i=new Ys,s=[0,.35,.15],o=[0,.43,.215],a=[0,.49,.255];$s(n,{parts:[{f:Vt([0,.345,.085],[.125,.12,.165]),k:0,w:Ct(dn)},{f:Vt([0,.35,-.09],[.13,.118,.165]),k:.08,w:Ct(dn)},{f:Vt([0,.325,0],[.12,.1,.2]),k:.08,w:Ct(dn)},{f:Ae(s,o,.085,.05),k:.06,w:oa(s,a,[[-.25,tn],[.15,Kn],[.6,Zn],[1,jt]]),sigma:.04},{f:Ae([.065,.31,.15],[.062,.21,.152],.05,.034),k:.04,w:Ct(le(0,0)),sigma:.015},{f:Ae([-.065,.31,.15],[-.062,.21,.152],.05,.034),k:.04,w:Ct(le(1,0)),sigma:.015},{f:Ae([.07,.33,-.15],[.067,.22,-.19],.065,.036),k:.05,w:Ct(le(2,0)),sigma:.015},{f:Ae([-.07,.33,-.15],[-.067,.22,-.19],.065,.036),k:.05,w:Ct(le(3,0)),sigma:.015},{f:Ae([0,.39,-.24],[0,.33,-.285],.04,.03),k:.04,w:Ct(Jn),sigma:.015}],box:[-.2,.14,-.36,.2,.56,.34],res:.0095,sigma:.025,lumps:{amp:.012,cell:.03,stretch:1,seed:r+3,ao:.32},paint:(v,p,g,x,_,y,w)=>{w.tint=1,w.rough=.95,w.thin=.7;const T=Math.abs(v)>.03?Pt(.2,.25,p):1,R=(g-s[2])*.63+(p-s[1])*.78,E=1-Pt(.075,.1,R);w.wool=Math.min(T,E),w.fur=.018*w.wool,w.streak=1-w.wool}},i,.016);const c=e.headXf,l=v=>({f:Bl([.01*v,-.013,.143],[.004,.003,.007],.2,.5*v,.5*v),k:.004,sub:!0}),h=[{f:Vt([0,.005,.03],[.056,.056,.06]),k:0,w:Ct(jt)},{f:Ae([0,.012,.06],[0,-.005,.125],.038,.024),k:.03,w:Ct(jt)},{f:Vt([.028,-.02,.06],[.025,.03,.04]),k:.02,w:Ct(jt)},{f:Vt([-.028,-.02,.06],[.025,.03,.04]),k:.02,w:Ct(jt)},{f:Vt([0,-.014,.128],[.026,.026,.028]),k:.025,w:Ct(jt)},{f:Vt([0,-.032,.132],[.022,.011,.022]),k:.012,w:Ct(jt)},{f:Ae([0,-.036,.025],[0,-.04,.125],.026,.014),k:.015,w:Ct(pi),sigma:.006},{f:Vt([.038,.016,.066],[.018,.016,.02]),k:.016,w:Ct(jt)},{f:Vt([-.038,.016,.066],[.018,.016,.02]),k:.016,w:Ct(jt)},ql(c,[0,.39,.185],[0,.49,.258],.062,.042,s,a,.035),l(1),l(-1),{f:Vt([0,-.0405,.12],[.022,.002,.034]),k:.003,sub:!0}];$s(n,{parts:h,box:[-.09,-.21,-.11,.09,.08,.17],res:.0045,xf:c,flow:Wl(c),sigma:.012,paint:(v,p,g,x,_,y,w)=>{w.tint=1,w.rough=.85,w.streak=.55;const T=Pt(.142,.153,y)*Pt(-.03,-.021,_)*(1-Pt(.012,.02,Math.abs(x))),R=nn(11110787),E=Math.hypot(Math.abs(x)-.043,_-.012,y-.068),D=Math.max(T,.35*(1-Pt(.014,.024,E)),.3*Pt(.1,.135,y)*(1-Pt(-.04,-.025,_)));w.r=R[0],w.g=R[1],w.b=R[2],w.tint=1-D,w.rough=Ut(.85,.45,T),w.streak=.55*(1-T);const M=Gl(_,y,-.0405,.08,.155);M>0&&(w.r=Ut(w.r,mi[0],M),w.g=Ut(w.g,mi[1],M),w.b=Ut(w.b,mi[2],M),w.tint*=1-M);const S=Pt(.035,.056,_)*(1-Pt(.03,.065,y))*Pt(-.04,-.01,y);w.wool=S*.9,w.fur=.01*S}},i,.0068),Hl(n,{c:[.015,.012,.07],r:.0135,dir:[.8,.2,.55],iris:3876630,irisSize:.55,pupil:[.26,.12],protrude:.5,sdf:aa(h),lid:.3},c);const d=nn(14067612);for(const v of[1,-1])Ol(n,{base:[e.earL[0]*v,e.earL[1],e.earL[2]],dir:[.66*v,-.68,-.12],inner:[-.25*v,-.2,.95],length:.09,width:.027,thick:.0055,cup:.45,innerColor:d},c,v>0?Xs:js);const f=[[.31,.028,.032,0],[.24,.022,.026,0],[.19,.016,.019,0],[.17,.0145,.017,0],[.155,.0172,.0185,.002],[.14,.0135,.015,0],[.1,.0105,.012,0],[.065,.011,.0125,0],[.052,.0125,.0142,0],[.04,.011,.0125,.001],[.03,.012,.0135,.002],[.012,.0142,.017,.003],[.002,.015,.018,.004]],u=[[.33,.034,.045,0],[.26,.028,.038,0],[.21,.02,.028,-.004],[.19,.016,.022,-.006],[.175,.015,.02,-.007],[.16,.0125,.015,-.003],[.1,.0105,.012,0],[.065,.011,.0125,0],[.052,.0125,.0142,0],[.04,.011,.0125,.001],[.03,.012,.0135,.002],[.012,.0142,.017,.003],[.002,.015,.018,.004]],m=nn(9076082);for(let v=0;v<4;v++)Dr(n,e.legs[v],v,v<2?f:u,.03,m,.6,0,.004),Dr(i,e.legs[v],v,v<2?f:u,.03,m,.6,0,.004);return{kind:"lamb",rig:e,geometry:n.build(),shells:i.buildShells(6),radius:.6,height:.6}}function i_(r){const e={body:[0,.57,0],neck1:[0,.62,.29],neck2:[0,.74,.37],poll:[0,.86,.45],headTilt:.72,jaw:[0,-.04,.02],earL:[.04,.025,.02],earR:[-.04,.025,.02],tail:[0,.68,-.43],legs:[{hip:[.08,.54,.25],knee:[.08,.28,.255],fetlock:[.08,.075,.26],hoof:[.08,0,.28],front:!0},{hip:[-.08,.54,.25],knee:[-.08,.28,.255],fetlock:[-.08,.075,.26],hoof:[-.08,0,.28],front:!0},{hip:[.085,.56,-.28],knee:[.085,.31,-.37],fetlock:[.085,.075,-.345],hoof:[.085,0,-.325],front:!1},{hip:[-.085,.56,-.28],knee:[-.085,.31,-.37],fetlock:[-.085,.075,-.345],hoof:[-.085,0,-.325],front:!1}],grip:[0,.76,.1],center:[0,.57,0],muzzle:[0,-.03,.24],headXf:new Dt,scale:1,earDir:[.35,-.9,.1]};e.headXf=Vl(e.poll,.72);const n=new Ys,i=new Ys,s=[0,.62,.27],o=[0,.77,.38],a=[0,.855,.445];$s(n,{parts:[{f:Vt([0,.575,.18],[.135,.19,.26]),k:0,w:Ct(dn)},{f:Vt([0,.6,-.2],[.14,.165,.26]),k:.1,w:Ct(dn)},{f:Vt([0,.54,0],[.145,.165,.3]),k:.1,w:Ct(dn)},{f:Vt([0,.48,-.02],[.148,.1,.32]),k:.09,w:Ct(dn)},{f:Vt([0,.72,.2],[.06,.05,.14]),k:.08,w:Ct(dn)},{f:Ae(s,o,.1,.064),k:.09,w:oa(s,a,[[-.25,tn],[.15,Kn],[.6,Zn],[1,jt]]),sigma:.045},{f:Ae([.085,.52,.25],[.082,.4,.255],.06,.04),k:.05,w:Ct(le(0,0)),sigma:.02},{f:Ae([-.085,.52,.25],[-.082,.4,.255],.06,.04),k:.05,w:Ct(le(1,0)),sigma:.02},{f:Ae([.09,.55,-.28],[.088,.4,-.34],.08,.045),k:.06,w:Ct(le(2,0)),sigma:.02},{f:Ae([-.09,.55,-.28],[-.088,.4,-.34],.08,.045),k:.06,w:Ct(le(3,0)),sigma:.02},{f:Ae([0,.67,-.42],[0,.77,-.48],.028,.016),k:.03,w:Ct(Jn),sigma:.015}],box:[-.3,.25,-.6,.3,.92,.6],res:.019,sigma:.035,lumps:{amp:.012,cell:.05,stretch:.35,seed:r+7,ao:.3},paint:(p,g,x,_,y,w,T)=>{T.tint=1,T.rough=.72,T.thin=.3,T.streak=1,T.wool=1e-4;const R=Pt(.62,.4,g),E=Math.abs(p)>.05?Pt(.36,.44,g):1;T.fur=Ut(.03,.075,R)*E;const D=(x-.27)*.6+(g-.62)*.8;T.fur*=1-Pt(.1,.17,D)*.45}},i,.026);const c=e.headXf,l=p=>({f:Bl([.01*p,-.014,.238],[.0045,.003,.009],.5,.45*p,.55*p),k:.004,sub:!0}),h=[{f:Vt([0,0,.03],[.05,.052,.062]),k:0,w:Ct(jt)},{f:Vt([0,.02,.07],[.042,.028,.045]),k:.03,w:Ct(jt)},{f:Ae([0,.018,.07],[0,0,.205],.034,.02),k:.03,w:Ct(jt)},{f:Vt([0,.022,.13],[.025,.022,.065]),k:.03,w:Ct(jt)},{f:Vt([0,-.012,.14],[.03,.034,.07]),k:.028,w:Ct(jt)},{f:Vt([.028,-.028,.065],[.022,.03,.045]),k:.022,w:Ct(jt)},{f:Vt([-.028,-.028,.065],[.022,.03,.045]),k:.022,w:Ct(jt)},{f:Vt([0,-.018,.212],[.022,.025,.03]),k:.025,w:Ct(jt)},{f:Vt([0,-.036,.22],[.02,.01,.024]),k:.01,w:Ct(jt)},{f:Ae([0,-.042,.035],[0,-.046,.2],.026,.013),k:.016,w:Ct(pi),sigma:.008},{f:Vt([.036,.018,.078],[.017,.014,.02]),k:.016,w:Ct(jt)},{f:Vt([-.036,.018,.078],[.017,.014,.02]),k:.016,w:Ct(jt)},{f:Ae([0,-.055,.15],[0,-.1,.125],.013,.005),k:.016,w:Ct(pi),sigma:.01},ql(c,[0,.68,.32],[0,.85,.44],.078,.048,s,a,.045),l(1),l(-1),{f:Vt([0,-.0445,.2],[.021,.0024,.045]),k:.004,sub:!0},{f:Vt([0,-.03,.242],[.002,.012,.007]),k:.003,sub:!0}];$s(n,{parts:h,box:[-.11,-.3,-.16,.11,.1,.27],res:.0062,xf:c,flow:Wl(c),sigma:.014,paint:(p,g,x,_,y,w,T)=>{T.tint=1,T.rough=.62,T.streak=.5;const R=Pt(-.055,-.07,y)*Pt(.1,.12,w),E=Pt(-.05,-.09,y)*(1-Pt(0,.04,w));T.fur=.035*R+.035*E,T.streak=Ut(.5,1,R);const D=Pt(.215,.235,w)*Pt(-.04,-.028,y);T.ao=Ut(1,.6,D),T.rough=Ut(.62,.35,D);const M=Gl(y,w,-.0445,.15,.245);M>0&&(T.r=mi[0],T.g=mi[1],T.b=mi[2],T.tint*=1-M)}},i,.009),Hl(n,{c:[.015,.012,.085],r:.012,dir:[.85,.2,.4],iris:12884538,irisSize:.42,pupil:[.3,.085],protrude:.45,sdf:aa(h),lid:.45},c);for(const p of[1,-1])Ol(n,{base:[e.earL[0]*p,e.earL[1],e.earL[2]],dir:[.26*p,-.95,.14],inner:[-1*p,0,.15],length:.23,width:.05,thick:.006,cup:.3,innerColor:nn(3813420),curlTip:.4,fur:.006},c,p>0?Xs:js);const d=nn(4866104),f=nn(8221283);for(const p of[1,-1]){const g=new A(.026*p,.042,.04);H0(n,x=>{const _=x*1.55,y=.16,w=new A(0,.75,-.66).normalize(),T=new A(0,-.66,-.75).normalize();return g.clone().addScaledVector(w,y*Math.sin(_)).addScaledVector(T,y*(1-Math.cos(_))).add(new A(p*(.01*x+.045*x*x),0,0)).applyMatrix4(c)},x=>.017*Math.pow(1-x,.8)+.0025,x=>[1,.72+.06*Math.cos(2*x)],36,10,new A(1,0,0),(x,_,y)=>{y.r=Ut(d[0],f[0],x),y.g=Ut(d[1],f[1],x),y.b=Ut(d[2],f[2],x),y.tint=0,y.rough=.45,y.horn=_+1},jt)}const u=[[.54,.04,.045,0],[.42,.03,.038,0],[.34,.023,.029,0],[.3,.019,.024,0],[.28,.021,.024,.002],[.255,.017,.02,0],[.18,.0135,.016,0],[.11,.014,.016,0],[.082,.016,.019,0],[.062,.0145,.0168,.002],[.045,.0156,.0178,.004],[.02,.0182,.022,.006],[.003,.0195,.0245,.007]],m=[[.56,.045,.062,0],[.46,.04,.056,0],[.39,.03,.043,-.004],[.34,.022,.032,-.008],[.31,.019,.028,-.01],[.28,.016,.02,-.004],[.18,.0135,.016,0],[.11,.014,.016,0],[.082,.016,.019,0],[.062,.0145,.0168,.002],[.045,.0156,.0178,.004],[.02,.0182,.022,.006],[.003,.0195,.0245,.007]],v=nn(1315344);for(let p=0;p<4;p++)Dr(n,e.legs[p],p,p<2?u:m,.045,v,.7,.05,.006),Dr(i,e.legs[p],p,p<2?u:m,.045,v,.7,.05,.006);return{kind:"goat",rig:e,geometry:n.build(),shells:i.buildShells(6),radius:1,height:1.1}}const ol=new Map;function s_(r,t){switch(r){case"sheep":return Ru("sheep",t);case"ram":return Ru("ram",t+1);case"goat":return i_(t+2);default:return n_(t+3)}}function al(r){let t=ol.get(r);return t||(t={seed:r,kinds:{},refs:0},ol.set(r,t)),t}function r_(r){const t=al(r);return t.refs++,t}function o_(r){if(r.refs--,!(r.refs>0)){for(const t of Object.values(r.kinds))t&&(t.geometry.dispose(),t.shells?.dispose());ol.delete(r.seed)}}function Cs(r,t){let e=r.kinds[t];return e||(e=s_(t,r.seed),r.kinds[t]=e),e}const V0=`
float fl_hash13(vec3 p3) {
  p3 = fract(p3 * 0.1031);
  p3 += dot(p3, p3.zyx + 31.32);
  return fract((p3.x + p3.y) * p3.z);
}
float fl_vnoise(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(fl_hash13(i), fl_hash13(i + vec3(1.0, 0.0, 0.0)), f.x),
        mix(fl_hash13(i + vec3(0.0, 1.0, 0.0)), fl_hash13(i + vec3(1.0, 1.0, 0.0)), f.x), f.y),
    mix(mix(fl_hash13(i + vec3(0.0, 0.0, 1.0)), fl_hash13(i + vec3(1.0, 0.0, 1.0)), f.x),
        mix(fl_hash13(i + vec3(0.0, 1.0, 1.0)), fl_hash13(i + vec3(1.0, 1.0, 1.0)), f.x), f.y), f.z);
}
`,G0=`
#if NUM_DIR_LIGHTS > 0
{
  // Fleece / ear translucency and wrap lighting for the (last) directional light = the sun.
  // Shadow maps are unreliable on surfaces facing away from the light, so there we fall back
  // to a softened unshadowed light colour to avoid blotches.
  vec3 fl_L = directLight.direction;
  vec3 fl_V = normalize(vViewPosition);
  float fl_ndl = dot(normal, fl_L);
  vec3 fl_Lc = mix(directionalLights[NUM_DIR_LIGHTS - 1].color * 0.55, directLight.color, smoothstep(-0.2, 0.25, fl_ndl));
  float fl_back = pow(clamp(dot(-fl_L, fl_V), 0.0, 1.0), 4.0);
  float fl_rim = pow(1.0 - clamp(abs(dot(normal, fl_V)), 0.0, 1.0), 2.5);
  float fl_whole = smoothstep(0.75, 0.95, fl_Thin);
  float fl_tr = fl_Thin * uTrans * fl_back * mix(fl_rim * 1.6, 0.45 + 0.55 * fl_rim, fl_whole);
  float fl_wrap = clamp((fl_ndl + 0.5) / 1.5, 0.0, 1.0) - clamp(fl_ndl, 0.0, 1.0);
  reflectedLight.directDiffuse += fl_Lc * diffuseColor.rgb * (fl_tr + fl_Wrap * fl_wrap * 0.3);
}
#endif
`;function _o(r){const t=new Ns({color:16777215,vertexColors:!0,roughness:1,metalness:0,sheen:r.sheen,sheenRoughness:.75,sheenColor:new dt(r.wool).multiplyScalar(.9)}),e={uWool:{value:new dt(r.wool)},uHair:{value:new dt(r.hair)},uHair2:{value:new dt(r.hair2)},uMottle:{value:r.mottle},uDirt:{value:new dt(r.dirt)},uDirtH:{value:r.dirtH},uCurlFreq:{value:r.curlFreq},uCurlAmp:{value:r.curlAmp},uTrans:{value:r.trans},uSeed:{value:Math.random()*10}};return t.userData.uniforms=e,t.onBeforeCompile=n=>{Object.assign(n.uniforms,e),n.vertexShader=n.vertexShader.replace("#include <common>",`#include <common>
attribute vec4 aMat;
attribute vec4 aAux;
attribute vec3 aFlow;
varying vec4 vMat;
varying vec4 vAux;
varying vec3 vFlow;
varying vec3 vBindPos;`).replace("#include <begin_vertex>",`#include <begin_vertex>
vMat = aMat; vAux = aAux; vFlow = aFlow; vBindPos = position;`),n.fragmentShader=n.fragmentShader.replace("#include <common>",`#include <common>
uniform vec3 uWool; uniform vec3 uHair; uniform vec3 uHair2; uniform float uMottle;
uniform vec3 uDirt; uniform float uDirtH; uniform float uCurlFreq; uniform float uCurlAmp; uniform float uTrans; uniform float uSeed;
varying vec4 vMat; varying vec4 vAux; varying vec3 vFlow; varying vec3 vBindPos;
${V0}
vec3 fl_bump(vec3 surf_pos, vec3 surf_norm, float h, float faceDir) {
  vec3 dpdx = dFdx(surf_pos);
  vec3 dpdy = dFdy(surf_pos);
  float dhdx = dFdx(h);
  float dhdy = dFdy(h);
  vec3 r1 = cross(dpdy, surf_norm);
  vec3 r2 = cross(surf_norm, dpdx);
  float det = dot(dpdx, r1) * faceDir;
  vec3 grad = sign(det) * (dhdx * r1 + dhdy * r2);
  return normalize(abs(det) * surf_norm - grad);
}`).replace("#include <color_fragment>",`#include <color_fragment>
float fl_Wool = vMat.x;
float fl_Tint = vMat.y;
float fl_Thin = vMat.w;
float fl_Wrap = fl_Wool;
{
  vec3 bp = vBindPos;
  float mott = smoothstep(0.42, 0.62, fl_vnoise(bp * 22.0 + uSeed)) * uMottle;
  vec3 hair = mix(uHair, uHair2, mott);
  hair *= 0.85 + 0.3 * fl_vnoise(bp * 60.0);
  vec3 wool = uWool * mix(vec3(1.0), vec3(1.0, 0.93, 0.8), fl_vnoise(bp * 5.0 + uSeed) * 0.7);
  wool *= 0.9 + 0.2 * fl_vnoise(bp * 31.0);
  vec3 base = mix(hair, wool, smoothstep(0.0, 0.5, fl_Wool));
  diffuseColor.rgb = mix(vColor.rgb, base, fl_Tint) * vAux.w;
  float dn = fl_vnoise(bp * 7.0 + 3.1);
  float dirt = 1.0 - smoothstep(0.0, uDirtH, bp.y + (dn - 0.5) * uDirtH * 0.6);
  diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * uDirt, clamp(dirt, 0.0, 1.0) * 0.85);
}`).replace("#include <roughnessmap_fragment>","float roughnessFactor = vMat.z;").replace("#include <normal_fragment_maps>",`#include <normal_fragment_maps>
{
  vec3 bp = vBindPos;
  vec3 fl_pos = -vViewPosition;
  float fl_px = length(fwidth(fl_pos));
  float h = 0.0;
  if (fl_Wool > 0.02) {
    float c1 = abs(fl_vnoise(bp * uCurlFreq) * 2.0 - 1.0);
    float c2 = abs(fl_vnoise(bp * uCurlFreq * 2.3 + 7.0) * 2.0 - 1.0);
    float curls = (c1 * 0.65 + c2 * 0.35);
    h += curls * uCurlAmp * smoothstep(0.02, 0.5, fl_Wool);
    diffuseColor.rgb *= mix(1.0, 0.72 + 0.28 * curls, smoothstep(0.02, 0.5, fl_Wool));
  }
  if (vAux.z > 0.0) {
    // hair streaks stretched along the local hair flow
    vec3 fdir = normalize(vFlow);
    vec3 q = bp * 520.0 - fdir * dot(bp, fdir) * 480.0;
    float st = fl_vnoise(q) * 0.65 + fl_vnoise(q * 2.3 + 11.0) * 0.35;
    h += st * 0.0005 * vAux.z;
    diffuseColor.rgb *= 1.0 - 0.22 * vAux.z * (1.0 - st);
  }
  if (vAux.x > 0.0) {
    // annual growth rings: sharp-edged, slightly irregular ridges
    float rph = vAux.x * 70.0 + fl_vnoise(bp * 60.0) * 0.6;
    float fr = fract(rph);
    float rid = smoothstep(0.0, 0.8, fr) * (1.0 - smoothstep(0.8, 1.0, fr));
    h += rid * 0.0009;
    diffuseColor.rgb *= 0.9 + 0.1 * rid + 0.1 * (fl_vnoise(bp * 25.0) - 0.5);
  }
  h *= 1.0 - smoothstep(0.0025, 0.009, fl_px);
  normal = fl_bump(fl_pos, normal, h, faceDirection);
}`).replace("#include <lights_physical_fragment>",`#include <lights_physical_fragment>
#ifdef USE_SHEEN
material.sheenColor *= smoothstep(0.0, 0.5, fl_Wool) + 0.25 * vAux.z;
#endif`).replace("#include <lights_fragment_begin>",`#include <lights_fragment_begin>
${G0}`)},t.customProgramCacheKey=()=>"flock-body-v1",t}function yo(r){const t=new de({color:16777215,vertexColors:!0,roughness:r.rough,metalness:0}),e={uFurColor:{value:new dt(r.color)},uFiberFreq:{value:r.fiberFreq},uClumpFreq:{value:r.clumpFreq},uDroop:{value:r.droop},uHairMode:{value:r.hair},uTrans:{value:r.trans},uFurScale:{value:r.furScale},uShellCount:{value:r.count},uLod:{value:new ct(...r.lod??[14,55])}};return t.userData.uniforms=e,t.onBeforeCompile=n=>{Object.assign(n.uniforms,e),n.vertexShader=n.vertexShader.replace("#include <common>",`#include <common>
attribute vec4 aShell;
uniform float uDroop; uniform float uFurScale; uniform float uShellCount; uniform vec2 uLod;
varying vec4 vShell;
varying vec3 vBindPos;
varying float vLodThin;`).replace("#include <begin_vertex>",`#include <begin_vertex>
vShell = aShell; vBindPos = position;
{
  float L = aShell.y * uFurScale;
  float t = aShell.x;
  transformed += normal * (L * t) + vec3(0.0, -1.0, 0.0) * (L * uDroop * t * t);
}`).replace("#include <project_vertex>",`#include <project_vertex>
{
  // distance LOD: beyond uLod.x only every other shell is drawn, beyond uLod.y none
  vec3 fl_objW = (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
  float fl_cd = length(cameraPosition - fl_objW);
  float fl_idx = floor(aShell.x * uShellCount + 0.5) - 1.0;
  bool fl_keep = fl_cd < uLod.x || (fl_cd < uLod.y && mod(fl_idx, 2.0) > 0.5);
  vLodThin = fl_cd < uLod.x ? 0.0 : 1.0;
  if (!fl_keep) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
}`),n.fragmentShader=n.fragmentShader.replace("#include <common>",`#include <common>
uniform vec3 uFurColor; uniform float uFiberFreq; uniform float uClumpFreq; uniform float uHairMode; uniform float uTrans;
varying vec4 vShell; varying vec3 vBindPos; varying float vLodThin;
${V0}`).replace("#include <color_fragment>",`#include <color_fragment>
float fl_Thin = 0.7;
float fl_Wrap = 1.0 - uHairMode * 0.5;
{
  float t = vShell.x;
  vec3 bp = vBindPos;
  float px = length(fwidth(vViewPosition));
  float lod = smoothstep(0.004, 0.02, px);
  float clump = fl_vnoise(bp * uClumpFreq * mix(vec3(1.0), vec3(1.0, 0.22, 1.0), uHairMode) + vec3(0.0, vShell.w * 3.0, 0.0));
  vec3 fp = mix(bp * uFiberFreq, vec3(bp.x * uFiberFreq, bp.y * uFiberFreq * 0.07, bp.z * uFiberFreq), uHairMode);
  // crimp: wool fibres wander as they grow outward
  float cph = t * 9.0 + clump * 6.2831;
  fp += vec3(sin(cph), 0.0, cos(cph)) * 0.45 * (1.0 - uHairMode);
  float fib = fl_vnoise(fp);
  float fib2 = fl_vnoise(fp * 2.1 + 5.0);
  float m = mix(fib * 0.62 + fib2 * 0.38, 0.55, lod) * 0.7 + clump * 0.42;
  float thr = 0.2 + t * 0.62 - vLodThin * 0.08;
  if (m < thr) discard;
  float ao = mix(0.52, 1.0, t);
  float vari = mix(0.88 + 0.24 * fib, 0.55 + 0.9 * fib2 * clump, uHairMode);
  diffuseColor.rgb *= uFurColor * ao * vari;
}`).replace("#include <lights_fragment_begin>",`#include <lights_fragment_begin>
${G0}`)},t.customProgramCacheKey=()=>"flock-shell-v1",t}const Fn=new A,nc=new De,Cu=new De,a_=new Dt;let c_=0;class l_{constructor(t,e,n,i,s,o){b(this,"kind");b(this,"object");b(this,"position",new A);b(this,"heading",0);b(this,"state","graze");b(this,"bodyCenter");b(this,"backGrip");b(this,"carryMode","none");b(this,"aiEnabled",!0);b(this,"manualSpeed",0);b(this,"id");b(this,"bones",[]);b(this,"meshes",[]);b(this,"rig");b(this,"legs",[]);b(this,"rng");b(this,"flock");b(this,"speed",0);b(this,"yawRate",0);b(this,"phase",0);b(this,"gW",1);b(this,"gT",0);b(this,"gC",0);b(this,"walkSpeed",.65);b(this,"trotSpeed",1.9);b(this,"fleeSpeed",4.2);b(this,"sizeScale",1);b(this,"size");b(this,"timer",0);b(this,"target",new A);b(this,"fleeFrom",new A);b(this,"panic",0);b(this,"followT",0);b(this,"stopDist",4);b(this,"reactDelay",0);b(this,"stepT",0);b(this,"stepDir",0);b(this,"alert",0);b(this,"alertDir",0);b(this,"mother",null);b(this,"sepX",0);b(this,"sepZ",0);b(this,"lastSafe",new A);b(this,"graze",0);b(this,"neckPitch",0);b(this,"headPitch",0);b(this,"lookYaw",0);b(this,"lookPitch",0);b(this,"lookTYaw",0);b(this,"lookTPitch",0);b(this,"lookTimer",0);b(this,"nibble",0);b(this,"tugT",0);b(this,"chew",0);b(this,"bleatT",0);b(this,"earFlick",[0,0]);b(this,"earFlickT",[1,1]);b(this,"earSwing",[0,0]);b(this,"earVel",[0,0]);b(this,"tailWag",0);b(this,"tailWagT",2);b(this,"breath",0);b(this,"breathRate",1);b(this,"hopT",-1);b(this,"hopCool",3);b(this,"airY",0);b(this,"fallV",0);b(this,"recoverT",0);b(this,"recoverQ",new De);b(this,"bodyVy",0);b(this,"prevBodyY",0);b(this,"struggle",0);b(this,"neckGrazePitch",1.6);b(this,"grazeHeadPitch",0);b(this,"shellMesh",null);b(this,"walkSpeedOverride",-1);b(this,"desX",0);b(this,"desZ",0);b(this,"hopSpeed",0);b(this,"hopTwist",0);b(this,"carryBleatT",.5);b(this,"headPitchTotal",0);b(this,"roamT",0);this.flock=t,this.kind=e,this.id=c_++,this.rng=B0(o),this.rig=n.rig;const a=this.rig;this.object=new Ie,this.object.name=`${e}-${this.id}`;const c=(x,_,y,w)=>{const T=new R0;return T.name=w,T.position.set(_[0]-(y?y[0]:0),_[1]-(y?y[1]:0),_[2]-(y?y[2]:0)),x.add(T),T},l=this.bones;l[tn]=c(this.object,a.body,null,"body"),l[dn]=c(l[tn],a.body,a.body,"barrel"),l[Kn]=c(l[tn],a.neck1,a.body,"neck1"),l[Zn]=c(l[Kn],a.neck2,a.neck1,"neck2"),l[jt]=c(l[Zn],a.poll,a.neck2,"head");const h=a.headXf,d=new A(...a.jaw).applyMatrix4(h),f=new A(...a.earL).applyMatrix4(h),u=new A(...a.earR).applyMatrix4(h);l[pi]=c(l[jt],[d.x,d.y,d.z],a.poll,"jaw"),l[Xs]=c(l[jt],[f.x,f.y,f.z],a.poll,"earL"),l[js]=c(l[jt],[u.x,u.y,u.z],a.poll,"earR"),l[Jn]=c(l[tn],a.tail,a.body,"tail");for(let x=0;x<4;x++){const _=a.legs[x];l[le(x,0)]=c(l[tn],_.hip,a.body,`leg${x}a`),l[le(x,1)]=c(l[le(x,0)],_.knee,_.hip,`leg${x}b`),l[le(x,2)]=c(l[le(x,1)],_.fetlock,_.knee,`leg${x}c`);const y=(T,R)=>Math.hypot(R[1]-T[1],R[2]-T[2]),w=(T,R)=>Math.atan2(R[2]-T[2],-(R[1]-T[1]));this.legs.push({L1:y(_.hip,_.knee),L2:y(_.knee,_.fetlock),L3:y(_.fetlock,_.hoof),b1:w(_.hip,_.knee),b2:w(_.knee,_.fetlock),b3:w(_.fetlock,_.hoof),hipLocal:new A(_.hip[0]-a.body[0],_.hip[1]-a.body[1],_.hip[2]-a.body[2]),rest:new A(_.hoof[0],0,_.hoof[2]),front:_.front,lift:0})}for(const x of[l[Kn],l[Zn],l[jt],l[pi],l[Jn],l[Xs],l[js]])x.rotation.order="YXZ";this.bodyCenter=new _e,this.bodyCenter.name="bodyCenter",this.bodyCenter.position.set(a.center[0]-a.body[0],a.center[1]-a.body[1],a.center[2]-a.body[2]),l[tn].add(this.bodyCenter),this.backGrip=new _e,this.backGrip.name="backGrip",this.backGrip.position.set(a.grip[0]-a.body[0],a.grip[1]-a.body[1],a.grip[2]-a.body[2]),l[tn].add(this.backGrip),this.object.updateMatrixWorld(!0);const m=new Al(l.slice()),v=new ni(new A(0,n.height*.5,0),n.radius),p=new nu(n.geometry,i);if(p.name=`${e}-body`,p.castShadow=!0,p.receiveShadow=!0,p.bind(m,new Dt),p.boundingSphere=v.clone(),this.object.add(p),this.meshes.push(p),n.shells&&s){const x=new nu(n.shells,s);x.name=`${e}-fur`,x.castShadow=!1,x.receiveShadow=!0,x.bind(m,new Dt),x.boundingSphere=v.clone(),x.renderOrder=1,this.object.add(x),this.meshes.push(x),this.shellMesh=x}const g=this.rng;switch(this.size=e==="lamb"?1:e==="ram"?1+g()*.05:.93+g()*.13,this.object.scale.setScalar(this.size),this.sizeScale=a.scale*this.size,e){case"sheep":this.walkSpeed=.55+g()*.2,this.trotSpeed=1.8+g()*.3,this.fleeSpeed=3.8+g()*.8;break;case"ram":this.walkSpeed=.6+g()*.15,this.trotSpeed=1.9,this.fleeSpeed=4.2;break;case"goat":this.walkSpeed=.7+g()*.2,this.trotSpeed=2+g()*.3,this.fleeSpeed=4.4+g()*.6;break;case"lamb":this.walkSpeed=.6,this.trotSpeed=1.7,this.fleeSpeed=3.6;break}this.phase=g(),this.breath=g()*Se,this.timer=1+g()*8,this.lookTimer=g()*3,this.hopCool=2+g()*6,this.tailWagT=g()*3,this.earFlickT=[g()*4,g()*4],this.graze=g()<.7?1:0,this.neckGrazePitch=this.solveGrazePitch()}get free(){return this.state!=="carried"}setCarried(t){if(t==="none"){if(this.state!=="carried"&&this.carryMode==="none")return;this.carryMode="none";const e=this.flock.group;this.object.parent!==e&&e.attach(this.object),this.object.updateWorldMatrix(!0,!1);const n=a_.copy(e.matrixWorld).invert().multiply(this.object.matrixWorld),i=new A,s=new De;n.decompose(i,s,Fn);const o=new A(0,0,1).applyQuaternion(s);Math.abs(o.x)+Math.abs(o.z)>1e-4&&(this.heading=Math.atan2(o.x,o.z));const a=this.flock.ground(i.x,i.z);this.position.set(i.x,a,i.z),this.airY=Math.max(0,i.y-a),this.fallV=0,this.recoverQ.copy(s),this.recoverT=1,this.speed=0,this.state="walk",this.panic=0,this.alert=1,this.target.copy(this.flock.centroid),this.timer=6,this.lastSafe.copy(this.position),this.object.position.copy(i),this.object.quaternion.copy(s),this.object.scale.setScalar(this.size)}else this.carryMode=t,this.state="carried",this.speed=0,this.hopT=-1,this.airY=0}bleat(t=.8){this.bleatT=.75,this.flock.emit(this,t)}goTo(t,e){this.state!=="carried"&&(this.state="walk",this.target.copy(t),this.timer=60,e!==void 0&&(this.walkSpeedOverride=e))}solveGrazePitch(){const t=this.rig,e=t.neck1,n=t.neck2,i=t.poll,s=new A(...t.muzzle).applyMatrix4(t.headXf),o=(d,f)=>{const u=(_,y,w)=>[_*Math.cos(w)-y*Math.sin(w),_*Math.sin(w)+y*Math.cos(w)],m=d*.5,v=d*.5,[p]=u(n[1]-e[1],n[2]-e[2],m),[g]=u(i[1]-n[1],i[2]-n[2],m+v),[x]=u(s.y-i[1],s.z-i[2],m+v+f);return e[1]+p+g+x},a=.03*t.scale;let c=0,l=1/0,h=0;for(let d=0;d<=2;d+=.01){const f=Oe(1.5-t.headTilt-d,-.7,.3),u=o(d,f);if(u<l&&(l=u,c=d,h=f),u<=a)break}return this.grazeHeadPitch=h,c}}const Ri={walk:{off:[.25,.75,0,.5],duty:.68},trot:{off:[0,.5,.5,0],duty:.48,stride:1.15},canter:{off:[.42,.52,0,.1],duty:.36,stride:1.9}};class Pu{constructor(t){b(this,"group");b(this,"animals",[]);b(this,"lamb");b(this,"onSound");b(this,"ground");b(this,"walkable");b(this,"centroid",new A);b(this,"allCentroid",new A);b(this,"pastureCenter",new A);b(this,"pastureRadius");b(this,"pastureTarget",new A);b(this,"rng");b(this,"cache");b(this,"materials",[]);b(this,"bleatTimer",3);b(this,"callPending",!1);b(this,"pending",[]);b(this,"time",0);b(this,"camPos",new A);b(this,"hasCam",!1);this.ground=t.ground,this.walkable=t.walkable,this.pastureCenter.copy(t.pastureCenter),this.pastureTarget.copy(t.pastureCenter),this.pastureRadius=t.pastureRadius;const e=t.seed??1234;this.rng=B0(e),this.group=new Ie,this.group.name="Flock";const n=t.sheep??15,i=t.rams??2,s=t.goats??8;this.cache=r_(e);const o=Cs(this.cache,"sheep"),a=i>0?Cs(this.cache,"ram"):null,c=s>0?Cs(this.cache,"goat"):null,l=Cs(this.cache,"lamb"),h=[15326402,14997176,15655884,14470576],f=[{wool:h[0],hair:6175266,hair2:6175266,mottle:0,dirt:9073240,dirtH:.42,curlFreq:90,curlAmp:.0035,sheen:.6,trans:.7},{wool:h[1],hair:2891028,hair2:2891028,mottle:0,dirt:8810586,dirtH:.45,curlFreq:90,curlAmp:.0035,sheen:.6,trans:.7},{wool:h[2],hair:1578001,hair2:1578001,mottle:0,dirt:9073240,dirtH:.4,curlFreq:90,curlAmp:.0035,sheen:.6,trans:.7},{wool:h[3],hair:8213042,hair2:8213042,mottle:0,dirt:8415828,dirtH:.48,curlFreq:90,curlAmp:.0035,sheen:.6,trans:.7},{wool:h[0],hair:4860954,hair2:14273717,mottle:.85,dirt:9073240,dirtH:.42,curlFreq:90,curlAmp:.0035,sheen:.6,trans:.7}].map(S=>this.track(_o(S))),u=[0,1,2,3].map(S=>this.track(yo({color:h[S],fiberFreq:520,clumpFreq:34,droop:.5,hair:0,trans:.9,rough:.95,furScale:1,count:5}))),m=this.track(_o({wool:14865590,hair:4138775,hair2:4138775,mottle:0,dirt:8415828,dirtH:.48,curlFreq:80,curlAmp:.004,sheen:.6,trans:.7})),v=this.track(yo({color:14865590,fiberFreq:480,clumpFreq:30,droop:.55,hair:0,trans:.9,rough:.95,furScale:1,count:5})),g=[{wool:1709586,hair:1709586,hair2:1709586,mottle:0,dirt:5917242,dirtH:.3,curlFreq:60,curlAmp:.001,sheen:0,trans:.4},{wool:2103829,hair:2103829,hair2:3811870,mottle:.25,dirt:5917242,dirtH:.3,curlFreq:60,curlAmp:.001,sheen:0,trans:.4}].map(S=>this.track(_o(S))),x=[1840915,2366486].map((S,k)=>this.track(yo({color:S,fiberFreq:420,clumpFreq:26,droop:.9,hair:1,trans:.5,rough:.7,furScale:1,count:6}))),_=this.track(_o({wool:16052196,hair:15722458,hair2:15722458,mottle:0,dirt:11048056,dirtH:.14,curlFreq:150,curlAmp:.0025,sheen:.8,trans:.9})),y=this.track(yo({color:16183783,fiberFreq:640,clumpFreq:60,droop:.1,hair:0,trans:1,rough:.95,furScale:1,count:6,lod:[25,80]})),w=this.rng;let T=e*7919+17;const R=(S,k,N,z)=>{const H=new l_(this,S,k,N,z,T++);return this.animals.push(H),this.group.add(H.object),H};for(let S=0;S<n;S++){const k=S%f.length;R("sheep",o,f[k],u[k%u.length])}if(a)for(let S=0;S<i;S++)R("ram",a,m,v);if(c)for(let S=0;S<s;S++)R("goat",c,g[S%g.length],x[S%x.length]);this.lamb=R("lamb",l,_,y);const E=this.animals.filter(S=>S.kind==="sheep");E.length&&(this.lamb.mother=E[Math.floor(w()*E.length)]);const D=[],M=Math.min(this.pastureRadius*.55,3+Math.sqrt(this.animals.length)*1.3);for(const S of this.animals){let k=0,N=0;for(let z=0;z<60;z++){const H=w()*Se,L=Math.sqrt(w())*M;if(k=this.pastureCenter.x+Math.cos(H)*L,N=this.pastureCenter.z+Math.sin(H)*L,S===this.lamb&&S.mother&&(k=S.mother.position.x+(w()-.5)*2,N=S.mother.position.z+(w()-.5)*2),!(this.walkable&&!this.walkable(k,N))&&D.every(V=>(V.x-k)**2+(V.z-N)**2>1.4*1.4))break}S.position.set(k,this.ground(k,N),N),S.heading=w()*Se-Fe,S.lastSafe.copy(S.position),D.push(S.position),S.object.position.copy(S.position),S.object.rotation.set(0,S.heading,0)}this.computeCentroid()}static preload(t=1234){const e=al(t);for(const n of["sheep","ram","goat","lamb"])Cs(e,n)}static async preloadAsync(t=1234){const e=al(t);for(const n of["lamb","sheep","ram","goat"])await new Promise(i=>setTimeout(i,0)),Cs(e,n)}track(t){return this.materials.push(t),t}call(t){let e=0;for(const n of this.animals){if(n.state==="carried")continue;const i=Math.hypot(n.position.x-t.x,n.position.z-t.z);i>70||n.state==="flee"&&n.panic>1.5||(n.state="follow",n.followT=12+n.rng()*2,n.stopDist=2.5+n.rng()*5.5,n.reactDelay=.15+n.rng()*1.1+i*.01,n.alert=1,n.target.copy(t),e++,n.rng()<.3&&this.pending.push({a:n,t:.3+n.rng()*1.5,v:.6+n.rng()*.3}))}return e>0&&(this.callPending=!0),e}setPasture(t,e){this.pastureTarget.copy(t),e!==void 0&&(this.pastureRadius=e)}countNear(t,e){let n=0;const i=e*e;for(const s of this.animals){let o=s.position.x,a=s.position.z;s.state==="carried"&&(s.object.getWorldPosition(Fn),o=Fn.x,a=Fn.z),(o-t.x)**2+(a-t.z)**2<=i&&n++}return n}panic(t){for(const e of this.animals){if(e.state==="carried")continue;const n=Math.hypot(e.position.x-t.x,e.position.z-t.z);this.startFlee(e,t,5+e.rng()*2.5,Math.min(.6,n*.02)+e.rng()*.15)}this.pending.push({a:this.animals[Math.floor(this.rng()*this.animals.length)],t:.05,v:1})}dispose(){o_(this.cache);for(const t of this.materials)t.dispose();for(const t of this.animals){for(const e of t.meshes)e.skeleton.dispose();t.object.removeFromParent()}this.group.removeFromParent()}emit(t,e){if(!this.onSound)return;const n=t.kind==="lamb"?"lambBleat":t.kind==="goat"?"goatBleat":"sheepBleat",i=new A;t.bones[jt].getWorldPosition(i),this.onSound(n,i,Oe(e,0,1))}update(t,e,n){if(t=Oe(t,0,.1),this.time=e,t<=0)return;const i=this.pastureTarget.clone().sub(this.pastureCenter);i.y=0;const s=i.length();if(s>.01&&this.pastureCenter.addScaledVector(i,Math.min(1,.7*t/s)),this.pastureCenter.y=this.pastureTarget.y,this.computeCentroid(),this.callPending){let a=0;for(const c of this.animals)c.state==="follow"&&a++;a===0&&(this.callPending=!1,Math.hypot(this.centroid.x-this.pastureCenter.x,this.centroid.z-this.pastureCenter.z)>this.pastureRadius*.6&&(this.pastureCenter.set(this.centroid.x,this.pastureTarget.y,this.centroid.z),this.pastureTarget.copy(this.pastureCenter)))}n.camera&&(n.camera.getWorldPosition(this.camPos),this.hasCam=!0);const o=this.animals;for(const a of o)a.sepX=0,a.sepZ=0;for(let a=0;a<o.length;a++){const c=o[a];if(c.state!=="carried")for(let l=a+1;l<o.length;l++){const h=o[l];if(h.state==="carried")continue;const d=c.position.x-h.position.x,f=c.position.z-h.position.z,u=.6*(c.sizeScale+h.sizeScale)+.3,m=d*d+f*f;if(m<u*u&&m>1e-8){const v=Math.sqrt(m),p=(u-v)/u,g=d/v,x=f/v;c.sepX+=g*p,c.sepZ+=x*p,h.sepX-=g*p,h.sepZ-=x*p}}}for(const a of o){if(a.state==="carried")continue;const c=a.position.x-n.shepherd.x,l=a.position.z-n.shepherd.z,h=c*c+l*l,d=1.1*a.sizeScale+.3;if(h<d*d&&h>1e-6){const f=Math.sqrt(h);a.sepX+=c/f*(d-f)/d*1.5,a.sepZ+=l/f*(d-f)/d*1.5}}for(const a of o)a.state!=="carried"&&(a.aiEnabled&&this.think(a,t,n),this.move(a,t));for(const a of o)this.animate(a,t,e);this.sounds(t)}computeCentroid(){let t=0;this.allCentroid.set(0,0,0);for(const n of this.animals)n.state!=="carried"&&(this.allCentroid.add(n.position),t++);t&&this.allCentroid.multiplyScalar(1/t);let e=0;this.centroid.set(0,0,0);for(const n of this.animals)n.state==="carried"||n.state==="flee"||(this.centroid.add(n.position),e++);e?this.centroid.multiplyScalar(1/e):this.centroid.copy(this.pastureCenter)}startFlee(t,e,n,i){t.state!=="carried"&&(t.state!=="flee"&&(t.reactDelay=i),t.state="flee",t.fleeFrom.copy(e),t.panic=Math.max(t.panic,n),t.alert=1,t.hopT=-1)}think(t,e,n){const i=t.rng,s=t.position.x,o=t.position.z;let a=1/0,c=null;for(const v of n.threats){const p=Math.hypot(v.x-s,v.z-o);p<a&&(a=p,c=v)}const l=t.kind==="goat"?10:11;if(c&&(a<l?this.startFlee(t,c,3.5+i()*2,.05+i()*.25):t.state==="flee"&&a<16&&(t.panic=Math.max(t.panic,1.2),t.fleeFrom.copy(c)),a<22&&(t.alert=Math.max(t.alert,1-(a-l)/12),t.alertDir=Math.atan2(c.x-s,c.z-o))),t.alert=Math.max(0,t.alert-e*.25),t.state!=="flee")for(const v of this.animals){if(v===t||v.state!=="flee"||v.panic<1.5||v.reactDelay>0)continue;if((v.position.x-s)**2+(v.position.z-o)**2<36){this.startFlee(t,v.fleeFrom,v.panic*.85,.15+i()*.35);break}}t.reactDelay>0&&(t.reactDelay-=e);let h=0,d=0,f=0;const u=(v,p,g)=>{const x=v-s,_=p-o,y=Math.hypot(x,_)||1;h=x/y*g,d=_/y*g,f=g};switch(t.state){case"graze":{if(t.timer-=e,t.graze=Math.min(1,t.graze+e*.8),t.stepT-=e,t.stepT<-2-i()*6&&(t.stepT=.8+i()*2.2,t.stepDir=t.heading+(i()-.5)*1.4),t.stepT>0&&(f=.12*t.sizeScale+.03,h=Math.sin(t.stepDir)*f,d=Math.cos(t.stepDir)*f),t.timer<=0)if(i()<.55){t.state="walk";const v=i()*Se,p=1.5+i()*5,g=t.roamT>0?0:.3;let x=Ut(this.centroid.x,this.pastureCenter.x,g)+Math.cos(v)*p,_=Ut(this.centroid.z,this.pastureCenter.z,g)+Math.sin(v)*p;const y=Math.hypot(x-this.pastureCenter.x,_-this.pastureCenter.z),w=this.pastureRadius*.85;y>w&&t.roamT<=0&&(x=this.pastureCenter.x+(x-this.pastureCenter.x)/y*w,_=this.pastureCenter.z+(_-this.pastureCenter.z)/y*w),t===this.lamb&&t.mother&&t.mother.state!=="carried"&&(x=t.mother.position.x+(i()-.5)*3,_=t.mother.position.z+(i()-.5)*3),t.target.set(x,0,_),t.timer=12}else t.timer=4+i()*10;break}case"walk":{t.timer-=e,t.graze=Math.max(0,t.graze-e*1.5);const v=Math.hypot(t.target.x-s,t.target.z-o),p=t.walkSpeedOverride>0?t.walkSpeedOverride:t.walkSpeed;u(t.target.x,t.target.z,p*Pt(.2,1.5,v)+.05),(v<.6||t.timer<=0)&&(t.state="graze",t.timer=5+i()*12,t.walkSpeedOverride=-1);break}case"follow":{if(t.followT-=e,t.graze=Math.max(0,t.graze-e*2),t.target.copy(n.shepherd),t.alertDir=Math.atan2(n.shepherd.x-s,n.shepherd.z-o),t.reactDelay>0)break;const v=Math.hypot(n.shepherd.x-s,n.shepherd.z-o);if(v>t.stopDist){const p=v>12?t.trotSpeed:v>6?Ut(t.walkSpeed*1.3,t.trotSpeed,(v-6)/6):t.walkSpeed*1.2;u(n.shepherd.x,n.shepherd.z,p*Pt(t.stopDist,t.stopDist+1.2,v))}t.followT<=0&&(t.state="graze",t.timer=3+i()*8,t.roamT=30);break}case"flee":{if(t.graze=0,(!c||a>15)&&(t.panic-=e),t.reactDelay>0)break;const p=s-t.fleeFrom.x,g=o-t.fleeFrom.z,x=Math.hypot(p,g)||1,_=this.allCentroid.x-t.fleeFrom.x,y=this.allCentroid.z-t.fleeFrom.z,w=Math.hypot(_,y)||1;let T=p/x*.45+_/w*.55,R=g/x*.45+y/w*.55;const E=Math.hypot(T,R)||1;T/=E,R/=E;const D=t.fleeSpeed*Oe(.35+t.panic*.3,.35,1);h=T*D,d=R*D,f=D;const M=this.allCentroid.x-s,S=this.allCentroid.z-o,k=Math.hypot(M,S);if(k>3){const N=Math.min(.5,(k-3)*.08);h+=M/k*D*N,d+=S/k*D*N}t.panic<=0&&(t.state="walk",t.target.copy(this.centroid),t.timer=10,t.panic=0,t.alert=1,t.breathRate=2.5);break}}if(t===this.lamb&&t.mother&&t.mother.state!=="carried"&&(t.state==="graze"||t.state==="walk")){const v=t.mother.position.x-s,p=t.mother.position.z-o,g=Math.hypot(v,p);g>3.5&&(t.state="walk",t.target.set(t.mother.position.x,0,t.mother.position.z),t.timer=8,t.walkSpeedOverride=g>7?1.6:.9)}if(t.roamT=Math.max(0,t.roamT-e),t.state==="graze"||t.state==="walk"){const v=this.centroid.x-s,p=this.centroid.z-o,g=Math.hypot(v,p),x=4+Math.sqrt(this.animals.length)*.9;if(g>x){const T=Math.min(1,(g-x)/6)*.35;h+=v/g*T,d+=p/g*T,t.state==="graze"&&g>x+5&&(t.state="walk",t.target.set(this.centroid.x+(i()-.5)*3,0,this.centroid.z+(i()-.5)*3),t.timer=12)}const _=this.pastureCenter.x-s,y=this.pastureCenter.z-o,w=Math.hypot(_,y);if(w>this.pastureRadius*.9&&t.roamT<=0){const T=Math.min(1.2,(w-this.pastureRadius*.9)/3);if(h+=_/w*T,d+=y/w*T,t.state==="graze"&&w>this.pastureRadius){t.state="walk";const R=Math.atan2(_,y)+(i()-.5),E=w-this.pastureRadius*(.3+i()*.4);t.target.set(s+Math.sin(R)*E,0,o+Math.cos(R)*E),t.timer=20}}}if(f>.4){let v=0,p=0,g=0;for(const x of this.animals){if(x===t||x.state==="carried"||x.speed<.3)continue;(x.position.x-s)**2+(x.position.z-o)**2<9&&(v+=Math.sin(x.heading),p+=Math.cos(x.heading),g++)}if(g){const x=t.state==="flee"?.35:.2;h=h*(1-x)+v/g*f*x,d=d*(1-x)+p/g*f*x}}h+=t.sepX*.8,d+=t.sepZ*.8;const m=Math.hypot(h,d);if(this.walkable&&m>.05){const v=.8+Math.min(m,4)*.5,p=Math.atan2(h,d);if(!this.walkable(s+Math.sin(p)*v,o+Math.cos(p)*v)){let g=!1;for(const x of[.5,-.5,1,-1,1.6,-1.6,2.2,-2.2,Fe]){const _=p+(t.id%2?x:-x);if(this.walkable(s+Math.sin(_)*v,o+Math.cos(_)*v)){h=Math.sin(_)*m,d=Math.cos(_)*m,g=!0;break}}g?t.state==="walk"&&t.rng()<e*.5&&(t.timer=0):(h=0,d=0)}}t.desX=h,t.desZ=d}move(t,e){let n,i;t.aiEnabled?(n=t.desX,i=t.desZ):(n=Math.sin(t.heading)*t.manualSpeed,i=Math.cos(t.heading)*t.manualSpeed);const s=Math.hypot(n,i),o=t.heading,a=t.state==="flee";if(s>.03&&t.hopT<0){const f=Ai(Math.atan2(n,i)-t.heading),u=(a?3.4:t.speed>1.2?2.2:1.3)*e;t.heading=Ai(t.heading+Oe(f,-u,u));const m=Math.cos(f),v=s*Oe(m*1.3,a?.45:.1,1),p=v>t.speed?a?6:1.4:2.5;t.speed=Su(t.speed,v,p*e)}else t.hopT<0&&(t.speed=Su(t.speed,0,2.5*e));if(t.speed<.08&&t.alert>.5&&t.state!=="flee"&&t.reactDelay<=0&&t.state!=="follow"){const f=Ai(t.alertDir-t.heading);Math.abs(f)>1.2&&(t.heading=Ai(t.heading+Oe(f,-1,1)*e*.8))}if(t.state==="follow"&&t.speed<.1&&t.reactDelay<=0){const f=Ai(t.alertDir-t.heading);Math.abs(f)>.6&&(t.heading=Ai(t.heading+Oe(f,-1,1)*e*.9))}t.yawRate=Ai(t.heading-o)/e;let c=t.speed;t.hopT>=0&&(c=t.hopSpeed);const l=1.8*Math.max(1,t.speed*.9);let h=t.position.x+Math.sin(t.heading)*c*e+t.sepX*e*l,d=t.position.z+Math.cos(t.heading)*c*e+t.sepZ*e*l;if(this.walkable)if(this.walkable(h,d))t.lastSafe.set(h,0,d);else if(this.walkable(t.position.x,t.position.z))h=t.position.x,d=t.position.z,t.speed*=.5;else{const f=t.lastSafe.x-t.position.x,u=t.lastSafe.z-t.position.z,m=Math.hypot(f,u)||1;h=t.position.x+f/m*Math.min(m,e*1),d=t.position.z+u/m*Math.min(m,e*1)}t.position.set(h,this.ground(h,d),d)}animate(t,e,n){const i=t.bones,s=t.rig,o=s.scale,a=t.rng,c=t.object;t.shellMesh&&this.hasCam&&(c.getWorldPosition(Fn),t.shellMesh.visible=Fn.distanceToSquared(this.camPos)<45*45),t.breathRate=An(t.breathRate,t.state==="flee"?2.8:1,.2,e),t.breath+=e*Se*.3*t.breathRate;const l=Math.sin(t.breath)*.012*(.7+.3*t.breathRate);i[dn].scale.set(1+l,1+l*.9,1+l*.3),t.bleatT=Math.max(0,t.bleatT-e);const h=t.bleatT>0?Math.sin(Oe(t.bleatT/.75,0,1)*Fe):0;if(t.state==="carried"){this.animateCarried(t,e,n,h),this.animateEars(t,e,0,n);return}t.airY>0&&(t.fallV-=9.8*e,t.airY=Math.max(0,t.airY+t.fallV*e)),c.position.set(t.position.x,t.position.y+t.airY,t.position.z),nc.setFromAxisAngle(Fn.set(0,1,0),t.heading),t.recoverT>0?(t.recoverT=Math.max(0,t.recoverT-e*3),c.quaternion.copy(nc).slerp(t.recoverQ,t.recoverT*t.recoverT)):c.quaternion.copy(nc);const d=Math.sin(t.heading),f=Math.cos(t.heading),u=t.size,m=.36*o*u,v=.12*o*u,p=t.position.x,g=t.position.z,x=this.ground(p+d*m,g+f*m),_=this.ground(p-d*m,g-f*m),y=this.ground(p+f*v,g-d*v),w=this.ground(p-f*v,g+d*v),T=t.position.y,R=Math.atan2(_-x,2*m)*.75,E=Math.atan2(y-w,2*v)*.3,D=t.hopT>=0?0:t.speed,M=D<1.25*o+.1?0:D<2.7?1:2;t.gW=An(t.gW,M===0?1:0,6,e),t.gT=An(t.gT,M===1?1:0,6,e),t.gC=An(t.gC,M===2?1:0,6,e);const S=t.gW+t.gT+t.gC,k=t.gW/S,N=t.gT/S,z=t.gC/S,L=(.3+Math.min(D,1.3)*.36)*o*k+Ri.trot.stride*o*N+Ri.canter.stride*o*z,V=Ri.walk.duty*k+Ri.trot.duty*N+Ri.canter.duty*z,O=Math.min(Math.abs(t.yawRate),2)*.35;t.phase=(t.phase+(D/(L*u)+O)*e)%1;const P=Pt(.015,.18,D+O*.3),B=t.phase;let G=0,Q=0,ut=0;G+=-Math.cos(B*Se*2)*.007*o*k*P,ut+=Math.sin(B*Se)*.025*k*P,G+=-Math.cos(B*Se*2)*.018*o*N*P,G+=Math.sin(B*Se+.6)*.045*o*z*P,Q+=Math.sin(B*Se-.9)*.1*z*P;let X=0,Z=0,rt=0;if(t.kind==="lamb"&&(t.hopCool-=e,t.hopT<0&&t.hopCool<=0&&t.aiEnabled&&(t.state==="graze"||t.state==="walk"||t.state==="follow")&&t.speed<1.5&&(t.hopT=0,t.hopCool=3+a()*8,t.hopSpeed=t.speed+.5+a()*.6,t.hopTwist=(a()-.5)*.8,a()<.35&&this.pending.push({a:t,t:.1,v:.5})),t.hopT>=0)){t.hopT+=e/.62;const vt=t.hopT;if(vt<.2)X=-.035*Math.sin(vt/.2*Fe*.5);else if(vt<.8){const ft=(vt-.2)/.6;X=-.035*(1-ft)+.2*Math.sin(ft*Fe),rt=Math.sin(ft*Fe),Z=-.25*Math.cos(ft*Fe)}else X=-.03*Math.sin((vt-.8)/.2*Fe);vt>=1&&(t.hopT=-1,t.speed=Math.min(t.speed,t.hopSpeed))}const J=t.graze*(1-Pt(.15,.4,t.speed)),ot=s.body[1]+((x+_)*.5-T)/u+G+X-J*.025*o,lt=i[tn];lt.position.set(s.body[0],ot,s.body[2]);const bt=R+Q+Z+J*.06,At=E+ut;lt.rotation.set(bt,t.hopT>=0?Math.sin(Oe(t.hopT,0,1)*Fe)*t.hopTwist:0,At);const st=(ot-t.prevBodyY)/e,F=(st-t.bodyVy)/e;t.bodyVy=st,t.prevBodyY=ot,Cu.setFromEuler(lt.rotation).invert();const Gt=[0,1,2,3].map(vt=>Ri.walk.off[vt]*k+Ri.trot.off[vt]*N+Ri.canter.off[vt]*z);for(let vt=0;vt<4;vt++){const ft=t.legs[vt],Kt=(B+Gt[vt])%1;let mt=0,U=0,C=0;if(Kt<V)mt=L*V*(.5-Kt/V);else{const Ot=(Kt-V)/(1-V),Wt=Ot*Ot*(3-2*Ot);mt=L*V*(-.5+Wt),U=Math.pow(Math.sin(Ot*Fe),.8)*(.06+.05*N+.09*z)*o*(ft.front?1:.85),C=Math.sin(Ot*Fe)}mt*=P,U*=P,C*=P;let Y=ft.rest.z+mt;ft.front&&(Y+=J*.03*o),rt>0&&(U+=rt*.09,Y+=(ft.front?-1:1)*rt*.03,C=Math.max(C,rt));const nt=p+(ft.rest.x*f+Y*d)*u,ht=g+(-ft.rest.x*d+Y*f)*u,Nt=(this.ground(nt,ht)-T)/u+U-(X>0,0);Fn.set(ft.rest.x-s.body[0],Nt-ot,Y-s.body[2]).applyQuaternion(Cu),X>0&&(Fn.y+=X*(1-rt*.3)*0);const _t=Fn.y-ft.hipLocal.y,Tt=Fn.z-ft.hipLocal.z,se=ft.b3-bt-C*(ft.front?1.3:.9),pt=_t+ft.L3*Math.cos(se),Et=Tt-ft.L3*Math.sin(se);this.solveLeg(t,vt,pt,Et,se)}this.animateHead(t,e,n,J,h,k,N,z,B,P);const Lt=i[Jn];t.kind==="goat"?(t.tailWagT-=e,t.tailWagT<0&&(t.tailWag=.8,t.tailWagT=1.5+a()*5),t.tailWag=Math.max(0,t.tailWag-e),Lt.rotation.set(-.3-.1*t.alert,Math.sin(n*26)*.35*Math.min(1,t.tailWag*2),0)):t.kind==="lamb"?(t.tailWagT-=e,t.tailWagT<0&&(t.tailWag=.9,t.tailWagT=2+a()*5),t.tailWag=Math.max(0,t.tailWag-e),Lt.rotation.set(-.2*t.alert,Math.sin(n*24)*.45*Math.min(1,t.tailWag*2),0)):Lt.rotation.set(-.05*z*P+Math.sin(B*Se*2)*.03*z,Math.sin(B*Se)*.07*P,Math.sin(B*Se)*.04*P),t.headPitchTotal=bt+t.neckPitch+t.headPitch,this.animateEars(t,e,F,n)}solveLeg(t,e,n,i,s){const o=t.legs[e],a=t.bones;let c=Math.hypot(n,i);const l=(o.L1+o.L2)*.9995,h=Math.abs(o.L1-o.L2)+.02;c=Oe(c,h,l);const d=Math.atan2(i,-n),f=Oe((o.L1*o.L1+c*c-o.L2*o.L2)/(2*o.L1*c),-1,1),u=Math.acos(f),m=o.front?d+u:d-u,v=-o.L1*Math.cos(m),p=o.L1*Math.sin(m),g=-c*Math.cos(d),x=c*Math.sin(d),_=Math.atan2(x-p,-(g-v));a[le(e,0)].rotation.set(-(m-o.b1),0,0),a[le(e,1)].rotation.set(-(_-o.b2-(m-o.b1)),0,0),a[le(e,2)].rotation.set(-(s-o.b3-(_-o.b2)),0,0)}animateHead(t,e,n,i,s,o,a,c,l,h){const d=t.bones,f=t.rng;t.lookTimer-=e,t.lookTimer<=0&&(t.lookTimer=1.2+f()*3.5,t.lookTYaw=(f()-.5)*1.6,t.lookTPitch=(f()-.6)*.4,f()<.25&&(t.lookTYaw=0,t.lookTPitch=0));let u=t.lookTYaw*(1-i)*(t.speed>.8?.2:1),m=t.lookTPitch;if(t.alert>.3&&t.state!=="flee"){const R=Ai(t.alertDir-t.heading);u=Oe(R,-1.3,1.3),m=-.1}t.lookYaw=An(t.lookYaw,u,4,e),t.lookPitch=An(t.lookPitch,m,4,e);const v=Pt(.1,.5,t.speed);let p=Ut(.05,.15,v*o)-.12*c*v;p-=t.alert*.35*(1-i),t.state==="flee"&&(p=-.15-.1*c);let g=t.lookPitch;t.nibble+=e*(2.2+Math.sin(n*.7+t.id)*.8),t.tugT-=e;let x=0;i>.5&&t.tugT<0&&(t.tugT=.8+f()*2.2),t.tugT>0&&t.tugT<.25&&(x=Math.sin(t.tugT/.25*Fe)*.12);const _=Math.sin(t.nibble*.37)*.35;p=Ut(p,t.neckGrazePitch+Math.sin(t.nibble*3.1)*.02-x,i),g=Ut(g,t.grazeHeadPitch+Math.sin(t.nibble*2.3)*.08,i),p+=Math.sin(l*Se*2+1.2)*.04*o*h,p+=Math.sin(l*Se*2)*.03*a*h,p+=Math.sin(l*Se+2.2)*.12*c*h,p-=s*.3,g-=s*.25,t.neckPitch=An(t.neckPitch,p,5,e),t.headPitch=An(t.headPitch,g,6,e);const y=Ut(t.lookYaw,_,i);d[Kn].rotation.set(t.neckPitch*.5,y*.3,0),d[Zn].rotation.set(t.neckPitch*.5,y*.3,0),d[jt].rotation.set(t.headPitch,y*.4,Math.sin(n*.5+t.id)*.05*(1-v)),t.chew=An(t.chew,i>.3||t.state==="graze"?1:0,.8,e);const w=n*8.5+t.id,T=Math.max(0,Math.sin(w))*.09*t.chew;d[pi].rotation.set(T+s*.42,0,Math.sin(w*.5)*.05*t.chew)}animateEars(t,e,n,i){const s=t.bones,o=t.rng;for(let a=0;a<2;a++){t.earFlickT[a]-=e,t.earFlickT[a]<0&&(t.earFlickT[a]=1.5+o()*6,t.earFlick[a]=.3),t.earFlick[a]=Math.max(0,t.earFlick[a]-e);const c=-Oe(n,-40,40)*.004;t.earVel[a]+=(c-t.earSwing[a]*60-t.earVel[a]*7)*e,t.earSwing[a]+=t.earVel[a]*e;const l=a===0?1:-1,h=Math.sin(t.earFlick[a]/.3*Fe)*.5,d=t.alert*.35,f=s[a===0?Xs:js],u=Math.sin(i*1.3+a*2+t.id)*.04,m=-Oe(t.headPitchTotal,-.6,1.8)*.55;f.rotation.set(m-d*.6+u+t.earSwing[a]*.5,0,l*(t.earSwing[a]-h*.6-d*.5))}}animateCarried(t,e,n,i){const s=t.bones,o=t.rig,a=t.carryMode==="mouth",c=Math.max(0,Math.sin(n*1.9+t.id))**2*.7+Math.max(0,Math.sin(n*4.3+1.3))*.3;t.struggle=An(t.struggle,a?.35+.65*c:0,6,e);const l=t.struggle;if(s[tn].position.set(o.body[0],o.body[1],o.body[2]),a){s[tn].rotation.set(Math.sin(n*5.1)*.06*l,Math.sin(n*3.7)*.08*l,Math.sin(n*4.4)*.1*l);for(let f=0;f<4;f++){const u=t.legs[f],m=n*(8.5+f*1.1)+f*1.9,v=Math.sin(m)*.6*l,p=(u.front?.12:-.1)+v;s[le(f,0)].rotation.set(p,0,(f%2?-1:1)*(.06+.06*l));const g=.15+.55*Math.max(0,Math.sin(m+1.1))*l;s[le(f,1)].rotation.set(u.front?g:-g,0,0),s[le(f,2)].rotation.set(g*.5,0,0)}const h=-.6+Math.sin(n*3.1)*.15*l-i*.2,d=Math.sin(n*2.3+.5)*.55*l;t.neckPitch=An(t.neckPitch,h,8,e),s[Kn].rotation.set(t.neckPitch*.5,d*.4,0),s[Zn].rotation.set(t.neckPitch*.5,d*.3,0),s[jt].rotation.set(-.3-i*.25,d*.3,Math.sin(n*2.9)*.12*l),s[pi].rotation.set(i*.5+Math.max(0,Math.sin(n*7))*.04*l,0,0),s[Jn].rotation.set(-.3,Math.sin(n*14)*.4*l,0)}else{s[tn].rotation.set(0,0,0);for(let d=0;d<4;d++){const f=t.legs[d],u=Math.sin(n*1.1+d)*.04;f.front?(s[le(d,0)].rotation.set(-.5+u,0,(d%2?1:-1)*.12),s[le(d,1)].rotation.set(.3,0,0),s[le(d,2)].rotation.set(.35,0,0)):(s[le(d,0)].rotation.set(.45+u,0,(d%2?1:-1)*.1),s[le(d,1)].rotation.set(.2,0,0),s[le(d,2)].rotation.set(.3,0,0))}t.neckPitch=An(t.neckPitch,.35+Math.sin(n*.6)*.05-i*.4,3,e);const h=Math.sin(n*.37+t.id)*.25;s[Kn].rotation.set(t.neckPitch*.5,.3+h*.3,0),s[Zn].rotation.set(t.neckPitch*.5,.25+h*.3,0),s[jt].rotation.set(.05-i*.2,.2+h*.4,.12),s[pi].rotation.set(i*.4,0,0),s[Jn].rotation.set(.2,0,0)}t.headPitchTotal=0}sounds(t){const e=this.rng;for(let i=this.pending.length-1;i>=0;i--){const s=this.pending[i];s.t-=t,s.t<=0&&(this.pending.splice(i,1),s.a.bleat(s.v))}let n=!1;for(const i of this.animals)i.state==="flee"&&i.reactDelay<=0?(n=!0,e()<t*.45*Oe(i.panic/3,.3,1)&&i.bleat(.75+e()*.25)):i.state==="carried"&&(i.carryBleatT-=t,i.carryBleatT<=0&&(i.carryMode==="mouth"?(i.carryBleatT=.7+e()*1.1,i.bleat(.9+e()*.1),i.mother&&i.mother.state!=="carried"&&e()<.3&&this.pending.push({a:i.mother,t:.4+e()*.8,v:.9})):(i.carryBleatT=5+e()*6,i.bleat(.3+e()*.15))));if(!n&&(this.bleatTimer-=t,this.bleatTimer<=0)){this.bleatTimer=4+e()*8;const i=this.animals.filter(s=>s.state!=="carried");if(i.length){const s=i[Math.floor(e()*i.length)];s.bleat(.45+e()*.4),s===this.lamb&&s.mother&&s.mother.state!=="carried"&&e()<.6?this.pending.push({a:s.mother,t:.7+e()*.8,v:.7}):s===this.lamb.mother&&this.lamb.state!=="carried"&&e()<.5&&this.pending.push({a:this.lamb,t:.6+e()*.8,v:.6})}}}}function Zt(r,t=0,e=0){return{r,hipsY:t,hipsZ:e}}const h_=r=>r*r*(3-2*r);class Wn{constructor(t,e=!1){b(this,"joints");this.keys=t,this.loop=e;const n=new Set;for(const i of t)for(const s of Object.keys(i.p.r))n.add(s);this.joints=[...n]}get duration(){return this.keys[this.keys.length-1].t}sample(t,e){const n=this.keys;let i=t;this.loop&&(i=(i%this.duration+this.duration)%this.duration),i=Math.min(Math.max(i,0),this.duration);let s=0;for(;s<n.length-2&&i>n[s+1].t;)s++;const o=n[s],a=n[Math.min(s+1,n.length-1)],c=a.t>o.t?h_((i-o.t)/(a.t-o.t)):0;for(const l of this.joints){const h=o.p.r[l]??Lu,d=a.p.r[l]??Lu,f=e.r[l]??(e.r[l]=[0,0,0]);f[0]=h[0]+(d[0]-h[0])*c,f[1]=h[1]+(d[1]-h[1])*c,f[2]=h[2]+(d[2]-h[2])*c}return e.hipsY=(o.p.hipsY??0)+((a.p.hipsY??0)-(o.p.hipsY??0))*c,e.hipsZ=(o.p.hipsZ??0)+((a.p.hipsZ??0)-(o.p.hipsZ??0))*c,e}}const Lu=[0,0,0];class W0{constructor(t){b(this,"cur",{r:{},hipsY:0,hipsZ:0});this.joints=t;for(const e of Object.keys(t))this.cur.r[e]=[0,0,0]}reset(){for(const t in this.cur.r){const e=this.cur.r[t];e[0]=e[1]=e[2]=0}this.cur.hipsY=0,this.cur.hipsZ=0}layer(t,e,n){if(e<=1e-4)return;const i=n??Object.keys(t.r);for(const s of i){const o=t.r[s],a=this.cur.r[s];!o||!a||(a[0]+=(o[0]-a[0])*e,a[1]+=(o[1]-a[1])*e,a[2]+=(o[2]-a[2])*e)}(!n||n.includes("hips"))&&(this.cur.hipsY+=((t.hipsY??0)-this.cur.hipsY)*e,this.cur.hipsZ+=((t.hipsZ??0)-this.cur.hipsZ)*e)}add(t,e,n=0,i=0){const s=this.cur.r[t];s&&(s[0]+=e,s[1]+=n,s[2]+=i)}apply(){for(const t in this.joints){const e=this.cur.r[t];this.joints[t].rotation.set(e[0],e[1],e[2])}}}const Fs=["uaR","faR","hdR"],No=["uaL","faL","hdL"],cl=["spine","chest","neck","head"];class ku{constructor(t,e,n){b(this,"mesh");b(this,"points");b(this,"geo");b(this,"radial",4);this.radius=e,this.points=Array.from({length:t},()=>new A);const i=t*this.radial;this.geo=new ge,this.geo.setAttribute("position",new te(new Float32Array(i*3),3).setUsage(ks)),this.geo.setAttribute("normal",new te(new Float32Array(i*3),3).setUsage(ks));const s=new Float32Array(i*2),o=[];for(let a=0;a<t;a++)for(let c=0;c<this.radial;c++)if(s[(a*this.radial+c)*2]=c/this.radial,s[(a*this.radial+c)*2+1]=a/(t-1),a<t-1){const l=a*this.radial+c,h=a*this.radial+(c+1)%this.radial,d=l+this.radial,f=h+this.radial;o.push(l,d,h,h,d,f)}this.geo.setAttribute("uv",new te(s,2)),this.geo.setIndex(o),this.mesh=new Ht(this.geo,n),this.mesh.frustumCulled=!1,this.mesh.castShadow=!0}update(){const t=this.geo.getAttribute("position"),e=this.geo.getAttribute("normal"),n=this.points.length,i=new A,s=new A,o=new A,a=new A(0,1,0),c=new A(1,0,0);for(let l=0;l<n;l++){const h=this.points[l],d=this.points[Math.max(0,l-1)],f=this.points[Math.min(n-1,l+1)];i.subVectors(f,d),i.lengthSq()<1e-10&&i.set(0,1,0),i.normalize(),s.crossVectors(i,Math.abs(i.y)>.9?c:a).normalize(),o.crossVectors(i,s).normalize();for(let u=0;u<this.radial;u++){const m=u/this.radial*Math.PI*2,v=Math.cos(m),p=Math.sin(m),g=s.x*v+o.x*p,x=s.y*v+o.y*p,_=s.z*v+o.z*p,y=l*this.radial+u;t.setXYZ(y,h.x+g*this.radius,h.y+x*this.radius,h.z+_*this.radius),e.setXYZ(y,g,x,_)}}t.needsUpdate=!0,e.needsUpdate=!0}}const dr=new Qs(4040);function fr(r,t,e,n=0,i=.35,s=14){const o=[],a=t*.9;for(let l=0;l<=4;l++){const h=l/4*(Math.PI/2);o.push(new ct(Math.sin(h)*t,Math.cos(h)*a*.6))}const c=10;for(let l=1;l<=c;l++){const h=l/c,d=Bt.lerp(t,e,h)+n*Math.exp(-((h-i)**2)/.03);o.push(new ct(d,-r*h))}for(let l=1;l<=4;l++){const h=l/4*(Math.PI/2);o.push(new ct(Math.cos(h)*e,-r-Math.sin(h)*e*.6))}return o[o.length-1].x=1e-4,o[0].x=1e-4,new fi(o,s)}function Qe(r,t,e,n=0,i=0,s=0,o=16,a=12){const c=new Xe(1,o,a);return c.scale(r,t,e),c.translate(n,i,s),c}function Ce(r,t){const e=r.getAttribute("position"),n=new Float32Array(e.count*3),i=new A;for(let s=0;s<e.count;s++){i.fromBufferAttribute(e,s);const o=typeof t=="function"?t(i):t;n[s*3]=o.r,n[s*3+1]=o.g,n[s*3+2]=o.b}return r.setAttribute("color",new te(n,3)),r}function Mo(r){const t=r.map(e=>{let n=e.index?e.toNonIndexed():e;n.getAttribute("uv")||n.setAttribute("uv",new te(new Float32Array(n.getAttribute("position").count*2),2)),n.getAttribute("color")||Ce(n,new dt(1,1,1));for(const i of Object.keys(n.attributes))["position","normal","uv","color"].includes(i)||n.deleteAttribute(i);return n});return kn(t)}const u_=Zt({hips:[0,0,.03],spine:[0,0,0],chest:[.02,0,0],neck:[0,0,0],head:[-.04,.08,0],uaL:[-.42,0,.2],faL:[-1.2,0,0],hdL:[.15,0,0],uaR:[.04,0,-.1],faR:[-.25,0,0],hdR:[0,0,0],thL:[-.06,0,.03],shinL:[.08,0,0],ftL:[-.02,0,0],thR:[.09,0,-.04],shinR:[.05,0,0],ftR:[-.12,0,0]}),Sr=Zt({spine:[0,-.12,0],chest:[.02,-.3,0],head:[0,.32,0],neck:[0,.05,0],uaR:[-2.75,0,-.35],faR:[-.35,0,0],hdR:[0,0,0],uaL:[-1.25,0,.3],faL:[-.25,0,0],hdL:[.1,0,0],thL:[-.2,0,.08],shinL:[.15,0,0],ftL:[.05,0,0],thR:[.25,0,-.08],shinR:[.1,0,0],ftR:[-.3,0,0]}),d_=new Wn([{t:0,p:Sr},{t:.1,p:Zt({spine:[0,-.2,0],chest:[-.05,-.55,0],head:[0,.45,0],uaR:[-2.3,.3,-1.1],faR:[-.6,0,0],uaL:[-1.4,0,.3],faL:[-.2,0,0],thL:[-.25,0,.08],thR:[.3,0,-.08],shinL:[.2,0,0],shinR:[.1,0,0]})},{t:.22,p:Zt({spine:[.12,.2,0],chest:[.15,.45,0],head:[.05,-.3,0],uaR:[-1.2,0,-.25],faR:[-.1,0,0],uaL:[-.4,0,.4],faL:[-.4,0,0],thL:[-.35,0,.08],thR:[.3,0,-.08],shinL:[.25,0,0],shinR:[.2,0,0]},-.04)},{t:.55,p:Zt({spine:[.05,.1,0],chest:[.1,.25,0],head:[0,-.2,0],uaR:[-.5,0,-.15],faR:[-.3,0,0],uaL:[-.35,0,.2],faL:[-.9,0,0],thL:[-.2,0,.05],thR:[.2,0,-.05],shinL:[.15,0,0],shinR:[.1,0,0]})}]),f_=new Wn([{t:0,p:Zt({uaR:[-.7,0,-.2],faR:[-1,0,0],hdR:[.6,0,0],uaL:[-.6,0,.2],faL:[-1.1,0,0],chest:[.05,0,0],spine:[0,0,0],thL:[-.25,0,.05],shinL:[.2,0,0],thR:[.2,0,-.05],shinR:[.1,0,0]})},{t:.14,p:Zt({uaR:[-2.9,0,-.15],faR:[-.5,0,0],hdR:[-.3,0,0],uaL:[-2.8,0,.1],faL:[-.6,0,0],chest:[-.2,-.2,0],spine:[-.1,0,0],head:[-.15,0,0],thL:[-.3,0,.05],shinL:[.25,0,0],thR:[.3,0,-.05],shinR:[.15,0,0]})},{t:.26,p:Zt({uaR:[-1.35,0,-.05],faR:[-.15,0,0],hdR:[1.3,0,0],uaL:[-1.3,0,.05],faL:[-.2,0,0],chest:[.35,.1,0],spine:[.2,0,0],head:[-.2,0,0],thL:[-.5,0,.05],shinL:[.45,0,0],thR:[.4,0,-.05],shinR:[.2,0,0],ftR:[-.3,0,0]},-.07)},{t:.6,p:Zt({uaR:[-.7,0,-.2],faR:[-1,0,0],hdR:[.6,0,0],uaL:[-.6,0,.2],faL:[-1.1,0,0],chest:[.05,0,0],spine:[0,0,0],head:[0,0,0],thL:[-.25,0,.05],shinL:[.2,0,0],thR:[.2,0,-.05],shinR:[.1,0,0]})}]),p_=new Wn([{t:0,p:Zt({uaR:[-1.6,0,-.5],faR:[-1,0,0],hdR:[.4,0,0],chest:[0,0,0]})},{t:.16,p:Zt({uaR:[-2.95,0,-.55],faR:[-1.1,0,0],hdR:[-.3,0,0],chest:[-.2,-.3,0],spine:[-.05,-.1,0]})},{t:.27,p:Zt({uaR:[-2,0,-.2],faR:[-.1,0,0],hdR:[1.6,0,0],chest:[.25,.25,0],spine:[.1,.1,0]})},{t:.55,p:Zt({uaR:[-1.6,0,-.5],faR:[-1,0,0],hdR:[.4,0,0],chest:[0,0,0],spine:[0,0,0]})}]),m_=Zt({uaL:[-2.25,0,.05],faL:[-.25,0,0],hdL:[0,0,0],chest:[.05,0,0],head:[-.3,0,0],neck:[-.1,0,0],thL:[-.35,0,.05],shinL:[.35,0,0],thR:[.35,0,-.05],shinR:[.25,0,0],ftR:[-.35,0,0]},-.05),g_=new Wn([{t:0,p:Zt({spine:[.45,0,0],chest:[.2,0,0],head:[-.1,0,0],uaL:[-1,0,.15],faL:[-.35,0,0],uaR:[-1,0,-.15],faR:[-.35,0,0],thL:[-.7,0,.05],shinL:[1.1,0,0],ftL:[-.4,0,0],thR:[.1,0,-.05],shinR:[.9,0,0],ftR:[-.2,0,0]},-.22)},{t:.3,p:Zt({spine:[.25,0,0],chest:[.05,0,0],head:[-.2,0,0],uaL:[-.8,0,.1],faL:[-.9,0,0],uaR:[-.8,0,-.1],faR:[-.9,0,0],thL:[-.6,0,.05],shinL:[.8,0,0],ftL:[-.2,0,0],thR:[.25,0,-.05],shinR:[.7,0,0],ftR:[-.3,0,0]},-.18,-.05)},{t:.6,p:Zt({spine:[.45,0,0],chest:[.2,0,0],head:[-.1,0,0],uaL:[-1,0,.15],faL:[-.35,0,0],uaR:[-1,0,-.15],faR:[-.35,0,0],thL:[-.7,0,.05],shinL:[1.1,0,0],ftL:[-.4,0,0],thR:[.1,0,-.05],shinR:[.9,0,0],ftR:[-.2,0,0]},-.22)}],!0),v_=Zt({uaL:[-.75,0,.8],faL:[-2,0,0],hdL:[.2,0,0],uaR:[-.75,0,-.8],faR:[-2,0,0],hdR:[.2,0,0],chest:[.1,0,0],head:[.05,0,0]}),Oi=Zt({}),x_=new Wn([{t:0,p:Oi},{t:.35,p:Zt({spine:[.7,0,0],chest:[.3,0,0],head:[.2,0,0],uaR:[-1,0,-.1],faR:[-.2,0,0],thL:[-1,0,.05],shinL:[1.5,0,0],ftL:[-.5,0,0],thR:[-.4,0,-.05],shinR:[1.3,0,0],ftR:[-.9,0,0]},-.38)},{t:.6,p:Zt({spine:[.7,0,0],chest:[.3,0,0],head:[.2,0,0],uaR:[-1.1,0,-.1],faR:[-.5,0,0],thL:[-1,0,.05],shinL:[1.5,0,0],ftL:[-.5,0,0],thR:[-.4,0,-.05],shinR:[1.3,0,0],ftR:[-.9,0,0]},-.38)},{t:.95,p:Oi}]),__=new Wn([{t:0,p:Oi},{t:.25,p:Zt({uaR:[-1.35,0,-.55],faR:[-2.35,0,0],hdR:[.3,0,0],head:[-.25,0,0],chest:[-.1,0,0]})},{t:1.15,p:Zt({uaR:[-1.35,0,-.55],faR:[-2.35,0,0],hdR:[.3,0,0],head:[-.3,0,0],chest:[-.12,0,0]})},{t:1.45,p:Oi}]),y_=new Wn([{t:0,p:Oi},{t:.12,p:Zt({spine:[.4,0,0],chest:[.2,0,0],thL:[-.9,0,.1],shinL:[1.3,0,0],thR:[-.4,0,-.1],shinR:[1.2,0,0],uaL:[-.8,0,.5],uaR:[-.8,0,-.5],faL:[-1.2,0,0],faR:[-1.2,0,0]},-.28)},{t:.38,p:Zt({spine:[.3,0,0],chest:[.15,0,0],thL:[-.6,0,.1],shinL:[.9,0,0],thR:[-.2,0,-.1],shinR:[.8,0,0],uaL:[-.7,0,.4],uaR:[-.7,0,-.4],faL:[-1.1,0,0],faR:[-1.1,0,0]},-.18)},{t:.55,p:Oi}]),M_=new Wn([{t:0,p:Oi},{t:.08,p:Zt({chest:[-.35,.2,0],spine:[-.15,0,0],head:[-.3,0,0],uaL:[-.5,0,.6],uaR:[-.5,0,-.6],faL:[-.8,0,0],faR:[-.8,0,0]},-.05)},{t:.45,p:Oi}]),b_=Zt({thL:[-1.45,0,.1],shinL:[1.6,0,0],ftL:[-.1,0,0],thR:[.35,0,-.1],shinR:[2.3,0,0],ftR:[.7,0,0],spine:[.35,0,0],chest:[.1,0,0],head:[.3,0,0],uaL:[-.6,0,.2],faL:[-.6,0,0],uaR:[-.3,0,-.2],faR:[-.4,0,0]},-.46),S_=Zt({uaL:[-.55,0,.65],faL:[-.9,0,0],hdL:[-.2,0,0],uaR:[-.55,0,-.65],faR:[-.9,0,0],hdR:[-.2,0,0],head:[-.42,0,0],neck:[-.12,0,0],chest:[-.1,0,0]}),Du={throw:{clip:d_},strike:{clip:f_},strikeHigh:{clip:p_,mask:[...Fs,"chest","spine"]},pick:{clip:x_},call:{clip:__,mask:[...Fs,"head","chest"]},dodge:{clip:y_},hurt:{clip:M_,mask:[...No,...Fs,...cl,"hips"]}};class w_{constructor(t){b(this,"root",new Ie);b(this,"j",{});b(this,"mixer");b(this,"staff",new Ie);b(this,"shoulderSocket",new _e);b(this,"handSocketR",new _e);b(this,"handSocketL",new _e);b(this,"skirtUniforms",{uLegL:{value:0},uLegR:{value:0},uSway:{value:new ct}});b(this,"hairGroup",new Ie);b(this,"speed",0);b(this,"phase",0);b(this,"locoW",0);b(this,"runW",0);b(this,"time",0);b(this,"hold","none");b(this,"holdW",{none:0,spin:0,grab:0,carry:0,kneel:0,thanks:0,pull:0});b(this,"action",null);b(this,"actionW",0);b(this,"pullT",0);b(this,"spinPhase",0);b(this,"spinPower",0);b(this,"staffMode","plant");b(this,"staffBlend",0);b(this,"staffBack",0);b(this,"lookTarget",null);b(this,"lookYaw",0);b(this,"lookPitch",0);b(this,"onFootstep");b(this,"lastStepSign",0);b(this,"ground");b(this,"sling",{state:"idle",pouch:new A,prev:new A,releaseT:0,loaded:!0});b(this,"cordA");b(this,"cordB");b(this,"pouchMesh");b(this,"stoneMesh");b(this,"slingInit",!1);this.tex=t,this.build(),this.mixer=new W0(this.j)}build(){const t=this.tex,e=new Ns({color:10648160,roughness:.5,metalness:0,sheen:.2,sheenColor:new dt(16756880),sheenRoughness:.55,vertexColors:!0});e.onBeforeCompile=st=>{st.fragmentShader=st.fragmentShader.replace("#include <lights_fragment_end>",`#include <lights_fragment_end>
reflectedLight.indirectDiffuse += diffuseColor.rgb * vec3(0.10, 0.025, 0.01);`)},e.customProgramCacheKey=()=>"skin";const n=t.linen.clone();n.repeat.set(7,5),n.needsUpdate=!0;const i=t.linenN.clone();i.repeat.set(7,5),i.needsUpdate=!0;const s=new de({map:n,normalMap:i,color:15853522,roughness:.97,side:cn});s.normalScale.set(.9,.9);const o=new de({map:t.leather,normalMap:t.leatherN,color:12884600,roughness:.72}),a=new de({map:t.leather,normalMap:t.leatherN,color:9071186,roughness:.75}),c=new Ns({color:16777215,vertexColors:!0,roughness:.62,sheen:1,sheenColor:new dt(12085818),sheenRoughness:.4}),l=new de({color:15327958,roughness:.18}),h=new Ns({color:4861463,roughness:.08,clearcoat:1,clearcoatRoughness:.05}),d=new de({color:328450,roughness:.05}),f=new de({normalMap:t.barkN,color:8017204,roughness:.62});f.normalScale.set(.6,.6);const u=(st,F,Gt,Lt,vt)=>{const ft=new Ie;return ft.name=st,ft.position.set(Gt,Lt,vt),F.add(ft),this.j[st]=ft,ft},m=(st,F,Gt,Lt=!0)=>{const vt=new Ht(F,Gt);return vt.castShadow=Lt,vt.receiveShadow=!0,st.add(vt),vt},v=u("hips",this.root,0,.97,0),p=u("spine",v,0,.08,0),g=u("chest",p,0,.2,0),x=u("neck",g,0,.23,0),_=u("head",x,0,.075,.01),y=u("uaL",g,.178,.17,-.01),w=u("faL",y,0,-.29,0),T=u("hdL",w,0,-.255,0),R=u("uaR",g,-.178,.17,-.01),E=u("faR",R,0,-.29,0),D=u("hdR",E,0,-.255,0),M=u("thL",v,.092,-.04,0),S=u("shinL",M,0,-.44,0),k=u("ftL",S,0,-.42,0),N=u("thR",v,-.092,-.04,0),z=u("shinR",N,0,-.44,0),H=u("ftR",z,0,-.42,0);for(const[st,F,Gt,Lt]of[[M,S,k,1],[N,z,H,-1]]){m(st,Ce(fr(.44,.078,.056,.008,.3),new dt(1,1,1)),e),m(F,Ce(fr(.42,.05,.034,.012,.28),new dt(1,1,1)),e);const vt=Qe(.045,.034,.12,0,-.03,.06,14,10),ft=vt.getAttribute("position");for(let mt=0;mt<ft.count;mt++){const U=ft.getY(mt);U<-.045&&ft.setY(mt,-.045+(U+.045)*.2),ft.getZ(mt)>.1&&ft.setX(mt,ft.getX(mt)*1.12)}vt.computeVertexNormals(),m(Gt,Ce(vt,new dt(1,1,1)),e);const Kt=new Vn(.1,.018,.27);Kt.translate(0,-.058,.055),m(Gt,Kt,a);for(let mt=0;mt<3;mt++){const U=new Is(.047+mt*.002,.006,5,18);U.rotateX(Math.PI/2+.3-mt*.15),U.translate(0,-.03+mt*.006,.03+mt*.05),U.scale(1,.75,1),m(Gt,U,o)}for(let mt=0;mt<5;mt++){const U=-.4+mt*.045,C=.036+mt*.003,Y=new Is(C,.0055,5,18);Y.rotateX(Math.PI/2+(mt%2?.35:-.35)),Y.translate(0,U,.004),m(F,Y,o)}}m(g,Ce(Qe(.145,.2,.098,0,.06,0),new dt(1,1,1)),e),m(p,Ce(Qe(.13,.14,.09,0,.05,0),new dt(1,1,1)),e),m(x,Ce(fr(.1,.056,.058,0,.5,12).rotateX(Math.PI).translate(0,.02,0),new dt(1,1,1)),e);const L=[[.074,.25],[.105,.232],[.155,.207],[.185,.17],[.178,.1],[.168,.02],[.158,-.08],[.152,-.16],[.152,-.24]],V=new fi(L.map(([st,F])=>new ct(st,F)),36);{const st=V.getAttribute("position");for(let F=0;F<st.count;F++){let Gt=st.getX(F),Lt=st.getY(F),vt=st.getZ(F);const ft=Math.atan2(Gt,vt);vt*=.7;const Kt=Bt.smoothstep(Lt,.05,.19);Gt*=1+.12*Kt;const mt=Math.max(0,Math.cos(ft)),U=Math.pow(mt,8)*Bt.smoothstep(Lt,.14,.25);Lt-=U*.05,vt+=U*.006;const C=dr.noise(ft*2.5,Lt*9)*.006,Y=Math.hypot(Gt,vt);Gt+=Gt/Y*C,vt+=vt/Y*C,st.setXYZ(F,Gt,Lt,vt)}V.computeVertexNormals()}m(g,V,s);for(const[st,F]of[[y,1],[R,-1]]){const Gt=new fi([new ct(.03,.075),new ct(.062,.05),new ct(.072,-.02),new ct(.075,-.1),new ct(.082,-.19)],20);m(st,Gt,s)}const O=[[.152,.12],[.162,.03],[.176,-.06],[.197,-.17],[.218,-.3],[.236,-.42],[.25,-.53],[.252,-.55]],P=new fi(O.map(([st,F])=>new ct(st,F)),40,0,Math.PI*2);{const st=P.getAttribute("position"),F=P.getAttribute("uv");for(let Gt=0;Gt<st.count;Gt++){let Lt=st.getX(Gt),vt=st.getY(Gt),ft=st.getZ(Gt);const Kt=Math.atan2(Lt,ft);ft*=.8;const mt=Bt.smoothstep(-vt,0,.5),U=Math.sin(Kt*9+dr.noise(Kt,.3)*2)*.012*mt+dr.noise(Kt*3,vt*4)*.008,C=Math.hypot(Lt,ft)||1;Lt+=Lt/C*U,ft+=ft/C*U,vt<-.5&&(vt+=dr.noise(Kt*4,1.7)*.025),st.setXYZ(Gt,Lt,vt,ft),F.setY(Gt,Bt.clamp((vt+.56)/.68,0,1))}P.computeVertexNormals()}const B=s.clone();B.map=n,B.normalMap=i;const G=this.skirtUniforms;B.onBeforeCompile=st=>{Object.assign(st.uniforms,G),st.vertexShader=st.vertexShader.replace("#include <common>",`#include <common>
uniform float uLegL; uniform float uLegR; uniform vec2 uSway; varying float vHem;`).replace("#include <begin_vertex>",`#include <begin_vertex>
{
  float below = max(0.0, -position.y - 0.02);
  float wl = smoothstep(-0.06, 0.12, position.x);
  float wr = smoothstep(0.06, -0.12, position.x);
  float dzl = -sin(uLegL) * below;
  float dzr = -sin(uLegR) * below;
  transformed.z += (dzl * wl + dzr * wr) * 0.95;
  transformed.y += (abs(dzl) * wl + abs(dzr) * wr) * 0.22;
  transformed.xz += uSway * below * below * 1.6;
  vHem = uv.y;
}`),st.fragmentShader=st.fragmentShader.replace("#include <common>",`#include <common>
varying float vHem;`).replace("#include <alphatest_fragment>","if (vHem < 0.045) { float f = fract(vMapUv.x * 9.0 * 16.0); if (f < 0.42 + (0.045 - vHem) * 8.0) discard; }")},B.customProgramCacheKey=()=>"skirt",m(v,P,B);const Q=new fi([new ct(.157,.1),new ct(.162,.065),new ct(.161,.03),new ct(.155,0)],36);Q.scale(1,1,.81),m(v,Q,o);for(let st=0;st<3;st++){const F=new Is(.162,.006,5,36);F.rotateX(Math.PI/2),F.scale(1,1,.81),F.translate(0,.015+st*.035,0),m(v,F,a)}const ut=Qe(.03,.025,.02,.07,.05,.135);m(v,ut,a);for(let st=0;st<4;st++){const F=new Vn(.014,.28+st*.03,.006);F.translate(0,-(.14+st*.015),0),F.rotateZ(.08*(st-1.5)),F.translate(.06+st*.012,.04,.14-st*.004),m(v,F,o)}const X=Mo([Qe(.075,.1,.045,0,0,0,16,12),new Vn(.13,.07,.02).translate(0,.05,.035)]),Z=m(v,X,o);Z.position.set(.2,-.13,.03),Z.rotation.set(.05,.9,.12);const rt=new Cl([new A(.19,-.33,.1),new A(.12,-.14,.125),new A(0,.02,.13),new A(-.11,.14,.115),new A(-.16,.22,.04),new A(-.14,.2,-.07),new A(-.03,.06,-.12),new A(.12,-.14,-.115),new A(.2,-.33,-.06)]),J=new sa(rt,48,.011,5,!1);J.scale(1,1,1),m(g,J,o);for(const[st,F,Gt,Lt]of[[y,w,T,1],[R,E,D,-1]]){m(st,Ce(fr(.29,.056,.044,.01,.4),new dt(1,1,1)),e),m(F,Ce(fr(.255,.046,.031,.009,.22),new dt(1,1,1)),e);const vt=Mo([Qe(.026,.045,.036,0,-.045,.004),Qe(.028,.022,.036,0,-.088,.012),Qe(.011,.028,.012,.022*Lt,-.05,.03)]);m(Gt,Ce(vt,new dt(1,1,1)),e)}this.handSocketL.position.set(0,-.075,.02),this.handSocketR.position.set(0,-.075,.02),T.add(this.handSocketL),D.add(this.handSocketR),this.buildHead(_,e,c,l,h,d);const ot=kr([new A(0,-1.06,0),new A(.01,-.5,.005),new A(-.005,.1,0),new A(.012,.74,-.004)],.022,.018,24,7,.1,7),lt=new Ht(ot,f);lt.castShadow=!0,this.staff.add(lt),this.root.add(this.staff);const bt=new de({color:10123861,roughness:.9});this.cordA=new ku(6,.0035,bt),this.cordB=new ku(6,.0035,bt);const At=new Xe(.045,12,8,0,Math.PI*2,Math.PI*.45,Math.PI*.55);At.scale(1.3,.8,.8),this.pouchMesh=new Ht(At,new de({map:t.leather,color:10517080,roughness:.8,side:cn})),this.pouchMesh.castShadow=!0,this.stoneMesh=new Ht(new Xe(.024,10,8),new de({color:13616820,roughness:.6})),this.stoneMesh.castShadow=!0,this.shoulderSocket.position.set(0,.25,-.06),this.shoulderSocket.rotation.set(0,Math.PI/2,0),g.add(this.shoulderSocket),this.root.traverse(st=>{st.isMesh&&(st.castShadow=!0,st.receiveShadow=!0)})}attachSling(t){t.add(this.cordA.mesh,this.cordB.mesh,this.pouchMesh,this.stoneMesh)}buildHead(t,e,n,i,s,o){const d=new Xe(1,48,36),f=d.getAttribute("position"),u=(E,D,M,S,k,N,z)=>Math.exp(-((E-S)**2+(D-k)**2+(M-N)**2)/(2*z*z));for(let E=0;E<f.count;E++){let D=f.getX(E),M=f.getY(E),S=f.getZ(E);const k=D,N=M,z=S,H=Bt.smoothstep(-M,.05,.95);D*=1-.24*H,S>0&&(S*=1+.06*Bt.smoothstep(-M,.5,.9)-.1*H*Bt.smoothstep(Math.abs(k),.2,.6)),D*=1-.05*Bt.smoothstep(M,.2,.7),S<0&&M>-.2&&(S*=1.07),S>.6&&(S=.6+(S-.6)*.75);let L=1;L-=.07*u(Math.abs(k),N,z,.4,.12,.86,.13),L+=.035*u(Math.abs(k),N,z,.35,.3,.88,.18),L+=.03*u(Math.abs(k),N,z,.62,-.08,.72,.17),L+=.02*u(k,N,z,0,-.52,.85,.16),D*=L,M*=L,S*=L,f.setXYZ(E,D*.074,M*.112+.1,S*.094)}d.computeVertexNormals();const m=E=>{const D=new dt(1,1,1),M=Math.max(Math.exp(-((E.x-.045)**2+(E.y-.1+.022)**2+(E.z-.07)**2)/(2*.02*.02)),Math.exp(-((E.x+.045)**2+(E.y-.1+.022)**2+(E.z-.07)**2)/(2*.02*.02))),S=Math.exp(-(E.x**2+(E.y-.1+.03)**2+(E.z-.1)**2)/(2*.015*.015)),k=Math.max(M*.8,S*.5);return D.setRGB(1,1-.14*k,1-.16*k),D},v=[Ce(d,m)],p=Qe(.0075,.026,.011,0,0,0,12,10);p.rotateX(-.32),p.translate(0,.1-.016,.089),v.push(Ce(p,m)),v.push(Ce(Qe(.0095,.0085,.0095,0,.1-.038,.1,12,10),m)),v.push(Ce(Qe(.0068,.0058,.0068,.0095,.1-.041,.094,10,8),m)),v.push(Ce(Qe(.0068,.0058,.0068,-.0095,.1-.041,.094,10,8),m));const g=new dt(.8,.58,.54);v.push(Ce(Qe(.0165,.0038,.0065,0,.1-.061,.0905,14,8),g)),v.push(Ce(Qe(.0145,.0045,.0068,0,.1-.0685,.0895,14,8),g));for(const E of[1,-1]){const D=Qe(.011,.028,.02,0,0,0,12,10);D.rotateY(-.35*E),D.translate(.073*E,.1-.005,-.005),v.push(Ce(D,new dt(1,.93,.9)))}t.scale.setScalar(1.07);const x=new Ht(Mo(v),e);x.castShadow=!0,t.add(x);for(const E of[1,-1]){const D=.0295*E,M=.1+.014,S=.07,k=new Ht(new Xe(.0118,16,12),i);k.position.set(D,M,S),t.add(k);const N=new Ht(new Xe(.0062,14,10),s);N.scale.set(1,1,.45),N.position.set(D,M-5e-4,S+.0098),t.add(N);const z=new Ht(new Xe(.0032,10,8),o);z.scale.set(1,1,.4),z.position.set(D,M-5e-4,S+.0124),t.add(z);const H=new Ht(Ce(new Xe(.0128,16,8,0,Math.PI*2,0,Math.PI*.4),new dt(.92,.8,.76)),e);H.position.set(D,M,S),H.rotation.x=.28;const L=new Ht(Ce(new Xe(.0126,16,6,0,Math.PI*2,Math.PI*.78,Math.PI*.22),new dt(.95,.85,.8)),e);L.position.set(D,M,S),L.rotation.x=-.2,t.add(L),t.add(H);const V=Qe(.017,.0036,.006,0,0,0,12,6),O=new Ht(Ce(V,new dt(.1,.035,.012)),n);O.position.set(D+.003*E,M+.0175,S+.0125),O.rotation.set(.25,.22*E,-.1*E),t.add(O)}const _=Gn(77),y=[],w=new Xe(1,32,20,0,Math.PI*2,0,Math.PI*.62);{const E=w.getAttribute("position");for(let D=0;D<E.count;D++){let M=E.getX(D),S=E.getY(D),k=E.getZ(D);if(k>.3&&S<.7){const N=Bt.smoothstep(k,.3,.75)*Bt.smoothstep(.7-S,0,.22);k-=N*.35,S+=N*.12}E.setXYZ(D,M*.074*1.06,S*.112*1.04+.1+.004,k*.094*1.05)}w.computeVertexNormals()}y.push(Ce(w,new dt(.06,.018,.006)));const T=new A;for(let E=0;E<420;E++){if(T.set(_()*2-1,_()*2-1,_()*2-1),T.lengthSq()>1||T.lengthSq()<.01){E--;continue}if(T.normalize(),T.y<-.25&&T.z>-.2||T.y<-.62||T.z>.3&&T.y<.6||T.z>.5&&T.y<.74)continue;const D=.011+_()*.011,M=$o(new qs(1,2).deleteAttribute("normal").deleteAttribute("uv")),S=M.getAttribute("position"),k=_()*100;for(let H=0;H<S.count;H++){const L=S.getX(H),V=S.getY(H),O=S.getZ(H),P=1+dr.noise(L*2+k,V*2+O)*.35;S.setXYZ(H,L*P,V*P*.8,O*P)}M.computeVertexNormals(),M.scale(D,D*(1+_()*.5),D),M.rotateX(_()*6),M.rotateY(_()*6);const N=1.02+_()*.12+(T.y>.5?.06:0);M.translate(T.x*.074*N*1.08,T.y*.112*N+.1+.008,T.z*.094*N*1.05);const z=_();y.push(Ce(M,new dt().setRGB(.085+z*.08,.026+z*.024,.009+z*.007)))}for(let E=0;E<22;E++){const D=(_()-.5)*1.8,M=E<9,S=.014+_()*.009,k=$o(new qs(S,2).deleteAttribute("normal").deleteAttribute("uv"));k.computeVertexNormals(),k.scale(1,1.3,1),M?k.translate(Math.sin(D)*.05,.1+.083+_()*.01,.066+Math.cos(D)*.01):k.translate(Math.sin(D*1.6)*.06,.1-.06-_()*.04,-.075-_()*.012);const N=_();y.push(Ce(k,new dt().setRGB(.09+N*.07,.028+N*.02,.009)))}const R=new Ht(Mo(y),n);R.castShadow=!0,this.hairGroup.add(R),t.add(this.hairGroup)}play(t,e=[]){const n=Du[t];this.action={clip:n.clip,t:0,mask:n.mask,events:e.map(i=>({...i,fired:!1}))}}get busy(){return!!this.action}get actionName(){if(!this.action)return null;for(const[t,e]of Object.entries(Du))if(e.clip===this.action.clip)return t;return null}worldOf(t,e=new A){return t.getWorldPosition(e)}update(t){this.time+=t;const e=this.mixer;e.reset();const n=this.speed;this.locoW=ue(this.locoW,Me(n/1.2,0,1),8,t),this.runW=ue(this.runW,Me((n-2.2)/2.5,0,1),6,t);const i=Bt.lerp(1.45,2.7,this.runW);this.phase+=Math.PI*2*n*t/i;const s=this.phase,o=Math.sin(s),a=Math.cos(s),c=Bt.lerp(.42,.85,this.runW)*this.locoW;e.layer(u_,1);const l=Math.sin(this.time*1.4);if(e.add("chest",l*.015),e.add("spine",0,0,Math.sin(this.time*.45)*.012),e.add("head",Math.sin(this.time*.37)*.03,Math.sin(this.time*.23)*.12*(1-this.locoW),0),this.locoW>.001){const d=this.locoW,f=Math.max(0,a)*Bt.lerp(.95,1.6,this.runW)+.12,u=Math.max(0,-a)*Bt.lerp(.95,1.6,this.runW)+.12,m=Zt({thL:[-o*c,0,.02],shinL:[f,0,0],ftL:[-(-o*c+f)*.55+Math.max(0,-o)*.25*d,0,0],thR:[o*c,0,-.02],shinR:[u,0,0],ftR:[-(o*c+u)*.55+Math.max(0,o)*.25*d,0,0],uaR:[o*Bt.lerp(.35,.9,this.runW),0,-.1],faR:[Bt.lerp(-.3,-1.4,this.runW),0,0],uaL:[-.42-o*Bt.lerp(.12,.6,this.runW),0,.2],faL:[Bt.lerp(-1.2,-1.5,this.runW),0,0],hips:[0,o*.1*d,0],spine:[Bt.lerp(.03,.18,this.runW),-o*.06,0],chest:[Bt.lerp(.02,.1,this.runW),-o*.1,0],head:[Bt.lerp(-.02,-.08,this.runW),o*.05,0],neck:[0,0,0],hdL:[.15,0,0],hdR:[0,0,0]},-Math.abs(a)*Bt.lerp(.025,.06,this.runW)-this.runW*.04);e.layer(m,d);const v=Math.sign(o);v!==this.lastStepSign&&d>.5&&this.onFootstep?.(v>0?"L":"R",this.runW>.5),this.lastStepSign=v}for(const d of Object.keys(this.holdW))this.holdW[d]=ue(this.holdW[d],this.hold===d?1:0,d==="spin"?12:6,t);if(this.holdW.spin>.001){const d=this.spinPhase,f=Zt({...Sr.r});f.r.uaR=[Sr.r.uaR[0]+Math.sin(d)*.14,0,Sr.r.uaR[2]+Math.cos(d)*.14],f.r.faR=[Sr.r.faR[0]+Math.sin(d+.8)*.12,0,0];const u=this.locoW>.3?[...Fs,...No,...cl]:void 0;e.layer(f,this.holdW.spin,u)}if(this.holdW.grab>.001&&e.layer(m_,this.holdW.grab),this.holdW.carry>.001&&e.layer(v_,this.holdW.carry,[...No,...Fs,"chest","head"]),this.holdW.kneel>.001&&e.layer(b_,this.holdW.kneel),this.holdW.thanks>.001&&e.layer(S_,this.holdW.thanks,[...No,...Fs,...cl]),this.holdW.pull>.001&&(this.pullT+=t,e.layer(g_.sample(this.pullT,{r:{}}),this.holdW.pull)),this.action){const d=this.action;d.t+=t;const f=d.clip.duration,u=Math.min(1,d.t/.06),m=Math.min(1,(f-d.t)/.12);this.actionW=Math.max(0,Math.min(u,m));const v=d.clip.sample(d.t,{r:{}});e.layer(v,this.actionW,d.mask);for(const p of d.events)!p.fired&&d.t>=p.t&&(p.fired=!0,p.fn());d.t>=f&&(this.action=null)}if(this.lookTarget){const d=this.j.neck.getWorldPosition(bo),f=this.root.worldToLocal(pr.copy(this.lookTarget)),u=this.root.worldToLocal(mr.copy(d)),m=f.sub(u),v=Me(Math.atan2(m.x,m.z),-1,1),p=Me(-Math.atan2(m.y,Math.hypot(m.x,m.z)),-.6,.5);this.lookYaw=ue(this.lookYaw,v,5,t),this.lookPitch=ue(this.lookPitch,p,5,t)}else this.lookYaw=ue(this.lookYaw,0,3,t),this.lookPitch=ue(this.lookPitch,0,3,t);e.add("head",this.lookPitch*.6,this.lookYaw*.6,0),e.add("neck",this.lookPitch*.3,this.lookYaw*.35,0),e.apply(),this.j.hips.position.y=.97+(e.cur.hipsY??0),this.j.hips.position.z=e.cur.hipsZ??0,this.root.updateMatrixWorld(!0),this.ground&&this.holdW.kneel<.5&&this.footIK(),this.skirtUniforms.uLegL.value=this.j.thL.rotation.x,this.skirtUniforms.uLegR.value=this.j.thR.rotation.x;const h=this.skirtUniforms.uSway.value;h.x=ue(h.x,Math.sin(this.phase)*.03*this.locoW,6,t),h.y=ue(h.y,-.05*this.runW-.02*this.locoW,4,t),this.updateStaff(t),this.root.updateMatrixWorld(!0)}footIK(){const n=this.root.position.y,i=[];for(const a of["L","R"]){const c=this.j["ft"+a],l=c.getWorldPosition(bo),h=this.ground(l.x,l.z);i.push({th:this.j["th"+a],sh:this.j["shin"+a],ft:c,delta:h-n})}const s=Math.min(0,i[0].delta,i[1].delta),o=Math.max(s,-.35);this.j.hips.position.y+=o;for(const a of i){const c=Me(a.delta-o,0,.4);if(c<.002)continue;const l=a.th.rotation.x,h=a.sh.rotation.x,d=-.44*Math.cos(l)-.42*Math.cos(l+h),f=-.44*Math.sin(l)-.42*Math.sin(l+h),u=d+c,m=f,v=Me(Math.hypot(u,m),.3,.44+.42-.001),p=Math.PI-Math.acos(Me((.44*.44+.42*.42-v*v)/(2*.44*.42),-1,1)),g=Math.atan2(-m,-u),x=Math.acos(Me((.44*.44+v*v-.42*.42)/(2*.44*v),-1,1)),_=g-x;a.ft.rotation.x+=l+h-(_+p),a.th.rotation.x=_,a.sh.rotation.x=p}}updateStaff(t){const e=this.staffMode==="strike"?1:0;this.staffBlend=ue(this.staffBlend,e,14,t),this.staffBack=ue(this.staffBack,this.staffMode==="back"?1:0,8,t),this.root.updateMatrixWorld(!0);const n=this.root.worldToLocal(this.handSocketL.getWorldPosition(bo)),i=this.root.worldToLocal(this.handSocketR.getWorldPosition(pr)),s=A_.setFromEuler(Iu.set(.06*this.locoW+.04,0,-.05)),o=this.j.hdR.getWorldQuaternion(R_),c=this.root.getWorldQuaternion(C_).invert().multiply(o),l=So.set(0,0,1).applyQuaternion(c),h=P_.setFromUnitVectors(ic.set(0,-1,0),l),d=L_.setFromEuler(Iu.set(0,0,.9)),f=mr.set(.02,1.25,-.16);this.staff.quaternion.copy(s).slerp(h,this.staffBlend).slerp(d,this.staffBack),this.staff.position.copy(n).lerp(i,this.staffBlend).lerp(f,this.staffBack)}staffTip(t=new A){return this.staff.localToWorld(t.set(0,-1.02,0))}updateSling(t,e){const n=this.sling,i=this.handSocketR.getWorldPosition(bo);this.slingInit||(n.pouch.copy(i).add(pr.set(0,-.5,0)),n.prev.copy(n.pouch),this.slingInit=!0);const s=n.state!=="stowed";if(this.cordA.mesh.visible=this.cordB.mesh.visible=this.pouchMesh.visible=s,this.stoneMesh.visible=s&&n.loaded&&n.state!=="release",!s)return;const o=.52;if(n.state==="spin"){this.spinPhase+=t*(Math.PI*2)*(1.8+this.spinPower*5.2);const d=mr.set(0,1,0).addScaledVector(e,-.35).normalize(),f=So.crossVectors(d,e).normalize(),u=ic.crossVectors(f,d).normalize(),m=this.spinPhase,v=pr.copy(i).addScaledVector(f,Math.cos(m)*o).addScaledVector(u,Math.sin(m)*o).addScaledVector(d,-.05);n.prev.copy(n.pouch),n.pouch.lerp(v,1-Math.exp(-30*t))}else{const d=pr.subVectors(n.pouch,n.prev).multiplyScalar(.985);n.prev.copy(n.pouch),n.pouch.add(d).add(mr.set(0,-9.8*t*t,0));const f=So.subVectors(n.pouch,i),u=f.length(),m=n.state==="release"?o*1.05:o;u>m&&n.pouch.copy(i).addScaledVector(f,m/u),n.state==="release"&&(n.releaseT+=t,n.releaseT>.5&&(n.state="idle"))}const a=So.subVectors(i,n.pouch).normalize(),c=ic.crossVectors(a,mr.set(0,1,.3).normalize()).normalize().multiplyScalar(.035),l=T_.copy(n.pouch).add(c),h=E_.copy(n.pouch).sub(c);for(let d=0;d<6;d++){const f=d/5,u=Math.sin(f*Math.PI)*(n.state==="spin"?0:.012);this.cordA.points[d].copy(i).lerp(l,f).y-=u,this.cordB.points[d].copy(i).lerp(h,f).y-=u}if(n.state==="release")for(let d=1;d<6;d++)this.cordB.points[d].copy(i).lerp(h,d/5*.5).addScaledVector(a,-.04*d);this.cordA.update(),this.cordB.update(),this.pouchMesh.position.copy(n.pouch),this.pouchMesh.lookAt(i),this.pouchMesh.rotateX(Math.PI/2),this.stoneMesh.position.copy(n.pouch).addScaledVector(a,-.012)}releaseSling(){const t=this.sling,e=t.pouch.clone(),n=t.pouch.clone().sub(t.prev);return t.state="release",t.releaseT=0,t.loaded=!1,{pos:e,vel:n}}}const bo=new A,pr=new A,mr=new A,So=new A,ic=new A,T_=new A,E_=new A,Iu=new Ve,A_=new De,R_=new De,C_=new De,P_=new De,L_=new De;class ll{constructor(t){b(this,"group",new Ie);b(this,"targets",[]);b(this,"stones",[]);b(this,"geo",new Xe(.028,10,8));b(this,"mat",new de({color:14208957,roughness:.55}));b(this,"trailGeo");b(this,"trailPos");b(this,"trailLine");b(this,"onGroundHit");this.ground=t,this.trailPos=new Float32Array(64*6),this.trailGeo=new ge,this.trailGeo.setAttribute("position",new te(this.trailPos,3).setUsage(ks)),this.trailLine=new dv(this.trailGeo,new C0({color:16773584,transparent:!0,opacity:.35,depthWrite:!1})),this.trailLine.frustumCulled=!1,this.group.add(this.trailLine)}fire(t,e){const n=new Ht(this.geo,this.mat);n.castShadow=!0,n.position.copy(t),this.group.add(n),this.stones.push({mesh:n,vel:e.clone(),life:0,resting:!1,trail:[t.clone()]})}static solve(t,e,n,i=9.81){const s=new A().subVectors(e,t),o=Math.hypot(s.x,s.z),a=s.y,c=n*n,l=c*c-i*(i*o*o+2*a*c);let h,d=!0;l<0||o<.01?(h=o<.01?Math.PI/2:Math.PI/4.3,d=!1):h=Math.atan2(c-Math.sqrt(l),i*o);const u=new A(s.x,0,s.z).normalize().multiplyScalar(Math.cos(h)*n);return u.y=Math.sin(h)*n,{vel:u,inRange:d}}update(t){const n=new A,i=new A;let s=0;for(const o of this.stones){if(o.life+=t,o.resting)continue;const a=4,c=t/a;for(let l=0;l<a&&!o.resting;l++){n.copy(o.mesh.position),o.vel.y-=9.81*c,o.mesh.position.addScaledVector(o.vel,c),i.copy(o.mesh.position);for(const d of this.targets)if(d.enabled()&&k_(n,i,d.center(),d.radius)){d.onHit(i.clone(),o.vel.clone()),o.resting=!0,o.life=99;break}if(o.resting)break;const h=this.ground(i.x,i.z);if(i.y<h+.02){o.mesh.position.y=h+.025;const d=o.vel.length();this.onGroundHit?.(o.mesh.position.clone(),d),o.vel.multiplyScalar(.25),o.vel.y=Math.abs(o.vel.y)*.3,d<4&&(o.resting=!0)}}o.mesh.rotation.x+=t*20,o.trail.push(o.mesh.position.clone()),o.trail.length>6&&o.trail.shift()}this.stones=this.stones.filter(o=>o.life>6?(this.group.remove(o.mesh),!1):!0);for(const o of this.stones)if(!(o.resting||o.life>1.5))for(let a=0;a<o.trail.length-1&&s<64;a++,s++)this.trailPos.set([o.trail[a].x,o.trail[a].y,o.trail[a].z,o.trail[a+1].x,o.trail[a+1].y,o.trail[a+1].z],s*6);this.trailGeo.setDrawRange(0,s*2),this.trailGeo.getAttribute("position").needsUpdate=!0}}function k_(r,t,e,n){const i=t.x-r.x,s=t.y-r.y,o=t.z-r.z,a=e.x-r.x,c=e.y-r.y,l=e.z-r.z,h=i*i+s*s+o*o;let d=h>0?(a*i+c*s+l*o)/h:0;d=Math.max(0,Math.min(1,d));const f=r.x+i*d-e.x,u=r.y+s*d-e.y,m=r.z+o*d-e.z;return f*f+u*u+m*m<=n*n}function D_(r,t,e,n){const i=r.x-e.x,s=r.y-e.y,o=r.z-e.z,a=i*t.x+s*t.y+o*t.z,c=i*i+s*s+o*o-n*n,l=a*a-c;if(l<0)return-1;const h=-a-Math.sqrt(l);return h>0?h:-1}class I_{constructor(t,e,n){b(this,"model");b(this,"pos",new A);b(this,"heading",0);b(this,"speed",0);b(this,"health",3);b(this,"maxHealth",3);b(this,"invuln",0);b(this,"controlEnabled",!1);b(this,"canSling",!1);b(this,"canStrike",!1);b(this,"canDodge",!1);b(this,"canSprint",!0);b(this,"carrying",!1);b(this,"aiming",!1);b(this,"power",0);b(this,"spinT",0);b(this,"dodgeT",-1);b(this,"dodgeDir",new A);b(this,"strikeT",-1);b(this,"aimPoint",new A);b(this,"aimOnTarget",!1);b(this,"aimInRange",!0);b(this,"onStrikeImpact");b(this,"onThrow");b(this,"onDodge");b(this,"outOfBounds",0);b(this,"throws",0);this.engine=t,this.projectiles=e,this.audio=n,this.model=new w_(t.tex),this.model.ground=(i,s)=>t.terrain.heightAt(i,s),this.model.attachSling(t.dynamic),t.scene.add(this.model.root),this.model.onFootstep=(i,s)=>{this.audio.at(s?"footstepRun":"footstep",this.pos,s?.55:.4)}}place(t,e,n){this.pos.set(t,this.engine.terrain.heightAt(t,e),e),this.heading=n,this.speed=0,this.syncModel()}syncModel(){this.model.root.position.copy(this.pos),this.model.root.rotation.y=this.heading}get forward(){return new A(Math.sin(this.heading),0,Math.cos(this.heading))}moveToward(t,e,n,i=.3){const s=new A(t.x-this.pos.x,0,t.z-this.pos.z),o=s.length();return o<i?(this.speed=ue(this.speed,0,8,n),!0):(s.normalize(),this.heading=Ls(this.heading,Math.atan2(s.x,s.z),8,n),this.speed=ue(this.speed,Math.min(e,o*2),6,n),this.pos.addScaledVector(s,this.speed*n),this.pos.y=this.engine.terrain.heightAt(this.pos.x,this.pos.z),!1)}faceToward(t,e,n=8){this.heading=Ls(this.heading,Math.atan2(t.x-this.pos.x,t.z-this.pos.z),n,e)}hurt(t,e=1){if(this.invuln>0||this.dodgeT>=0)return!1;this.health=Math.max(0,this.health-e),this.invuln=1.1,this.model.play("hurt");const n=new A(this.pos.x-t.x,0,this.pos.z-t.z).normalize().multiplyScalar(1.4);return this.pos.add(n),this.audio.sfx("davidHurt",{volume:.9}),!0}update(t,e,n,i){const s=this.model;this.invuln=Math.max(0,this.invuln-t);const o=n.forward(),a=new A(-o.z,0,o.x),c=this.controlEnabled?e.move:new ct,l=new A().addScaledVector(o,c.y).addScaledVector(a,c.x),h=Math.min(1,l.length());let d=0;if(h>.05&&(l.normalize(),d=h<.55?1.6:3,e.sprint&&this.canSprint&&!this.carrying&&!this.aiming&&(d=5.7),this.carrying&&(d=Math.min(d,2.1)),this.aiming&&(d=1.25),(s.hold==="pull"||s.hold==="grab")&&(d=0)),this.dodgeT<0&&this.controlEnabled){this.speed=ue(this.speed,d,d>this.speed?6:9,t),this.aiming?this.heading=Ls(this.heading,Math.atan2(o.x,o.z),14,t):h>.05&&(this.heading=Ls(this.heading,Math.atan2(l.x,l.z),9,t));const p=this.aiming&&h>.05?l:this.forward;this.speed>.01&&this.pos.addScaledVector(p,this.speed*t)}if(this.dodgeT>=0){this.dodgeT+=t;const p=Math.max(0,1-this.dodgeT/.42);this.pos.addScaledVector(this.dodgeDir,7.5*p*t),this.dodgeT>.5&&(this.dodgeT=-1)}this.engine.colliders.resolve(this.pos,.32);const f=Math.hypot(this.pos.x-Xt.start.x,this.pos.z-Xt.start.z),u=Xt.playRadius;this.outOfBounds=Math.max(0,f-(u-25)),f>u&&(this.pos.x=Xt.start.x+(this.pos.x-Xt.start.x)/f*u,this.pos.z=Xt.start.z+(this.pos.z-Xt.start.z)/f*u),this.pos.y=this.engine.terrain.heightAt(this.pos.x,this.pos.z),s.speed=this.dodgeT>=0?0:this.speed,this.syncModel();const m=s.sling;this.controlEnabled&&this.canSling&&!this.carrying&&!s.busy&&this.dodgeT<0&&e.slingHeld&&m.loaded&&(this.aiming||(this.aiming=!0,this.spinT=0),this.spinT+=t,this.power=Me(this.spinT/1.15,0,1),s.hold="spin",m.state="spin",s.spinPower=this.power),this.aiming?(this.computeAim(n),this.audio.slingSpin(!0,this.power),(e.takeRelease("sling")||!e.slingHeld)&&(this.aiming=!1,s.hold="none",this.audio.slingSpin(!1,0),this.power>.12?this.throwStone():m.state="idle")):e.takeRelease("sling"),n.aim=this.aiming?1:0,!m.loaded&&m.state==="idle"&&!s.busy&&(m.loaded=!0),e.take("strike")&&this.controlEnabled&&this.canStrike&&!this.carrying&&!s.busy&&!this.aiming&&(s.staffMode="strike",this.strikeT=0,s.play("strike",[{t:.13,fn:()=>this.audio.sfx("whoosh",{volume:.7})},{t:.26,fn:()=>this.onStrikeImpact?.(s.staffTip(),this.forward)}])),this.strikeT>=0&&(this.strikeT+=t,this.strikeT>.75&&s.hold!=="grab"&&(s.staffMode="plant",this.strikeT=-1)),e.take("dodge")&&this.controlEnabled&&this.canDodge&&this.dodgeT<0&&s.actionName!=="dodge"&&(this.dodgeDir.copy(h>.05?l:this.forward.multiplyScalar(-1)).setY(0).normalize(),this.dodgeT=0,this.invuln=Math.max(this.invuln,.45),s.play("dodge"),this.audio.sfx("dodge",{volume:.8}),this.onDodge?.()),s.update(t);const v=n.forward();s.updateSling(t,v)}computeAim(t){const e=this.engine.camera,n=e.position.clone(),i=new A;e.getWorldDirection(i);let s=1/0;this.aimOnTarget=!1;for(const c of this.projectiles.targets){if(!c.enabled())continue;const l=D_(n,i,c.center(),c.radius*1.35);l>0&&l<s&&(s=l,this.aimOnTarget=!0)}if(!this.aimOnTarget)for(let c=2;c<180;c+=1){const l=n.clone().addScaledVector(i,c);if(l.y<this.engine.terrain.heightAt(l.x,l.z)){s=c;break}}isFinite(s)||(s=120),this.aimPoint.copy(n).addScaledVector(i,s);const o=Bt.lerp(16,44,this.power),a=this.model.sling.pouch;this.aimInRange=ll.solve(a,this.aimPoint,o).inRange}throwStone(){const t=this.model,e=this.power,n=this.aimPoint.clone();t.play("throw",[{t:.19,fn:()=>{const i=t.sling.pouch.clone(),s=Bt.lerp(16,44,e),{vel:o}=ll.solve(i,n,s);this.projectiles.fire(i,o),t.releaseSling(),this.audio.sfx("slingRelease",{volume:.9}),this.throws++,this.onThrow?.()}}])}}const hl=16;function wo(r,t,e,n,i){const s=new de({color:16777215,roughness:.92,metalness:0}),o={uBase:{value:r},uTip:{value:t},uFurLen:{value:e},uDensity:{value:n},uWet:{value:0}};return s.onBeforeCompile=a=>{Object.assign(a.uniforms,o),a.vertexShader=a.vertexShader.replace("#include <common>",`#include <common>
uniform float uFurLen; varying vec3 vBasePos; varying float vLayer;`).replace("#include <begin_vertex>",`#include <begin_vertex>
vBasePos = position;
vLayer = 0.0;
${i?`
vLayer = float(gl_InstanceID) / ${(hl-1).toFixed(1)};
vec3 comb = normalize(normal + vec3(0.0, -0.55, -0.35));
transformed += mix(normal, comb, vLayer * 0.6) * vLayer * uFurLen;
`:""}`),a.fragmentShader=a.fragmentShader.replace("#include <common>",`#include <common>
uniform vec3 uBase; uniform vec3 uTip; uniform float uDensity; varying vec3 vBasePos; varying float vLayer;
float fh(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
vec3 fh3(vec3 p){ return vec3(fh(p), fh(p + 13.7), fh(p + 29.3)); }`).replace("#include <map_fragment>",`{
  vec3 q = vBasePos * uDensity;
  vec3 cell = floor(q);
  float h = fh(cell);
  float clump = fh(floor(vBasePos * uDensity * 0.18));
  ${i?`
  vec3 f = fract(q) - 0.5 - (fh3(cell) - 0.5) * 0.45;
  float d = length(f);
  float r = 0.72 * pow(1.0 - vLayer, 1.35) * (0.7 + 0.3 * h);
  if (vLayer > 0.02 && (d > r || h < vLayer * vLayer * 0.45)) discard;
  `:""}
  vec3 c = mix(uBase, uTip, clamp(vLayer * 1.3 + (clump - 0.5) * 0.4, 0.0, 1.0));
  c *= mix(0.62, 1.0, smoothstep(0.0, 0.7, vLayer)) * (0.88 + 0.24 * h);
  diffuseColor.rgb *= c;
}`)},s.customProgramCacheKey=()=>`fur-${i}-${r.getHexString()}-${t.getHexString()}-${e}`,s}function on(r,t,e,n=0,i=0,s=0,o=24,a=16){const c=new Xe(1,o,a);return c.scale(r,t,e),c.translate(n,i,s),c}function Nu(r,t,e,n=16){const i=[];i.push(new ct(1e-4,t*.5));for(let s=0;s<=3;s++){const o=s/3*(Math.PI/2);i.push(new ct(Math.sin(o)*t,Math.cos(o)*t*.5))}for(let s=1;s<=8;s++){const o=s/8;i.push(new ct(Bt.lerp(t,e,o)+Math.sin(o*Math.PI)*t*.08,-r*o))}return i.push(new ct(e*.7,-r-e*.4)),i.push(new ct(1e-4,-r-e*.55)),new fi(i,n)}function zn(r){return kn(r.map(t=>{const e=t.index?t.toNonIndexed():t;for(const n of Object.keys(e.attributes))["position","normal","uv"].includes(n)||e.deleteAttribute(n);return e}))}const N_=Zt({pelvis:[-1.18,0,0],spine:[.1,0,0],neck:[.55,0,0],head:[.35,0,0],hlUA:[1.05,0,.12],hlLA:[.2,0,0],hlP:[-.1,0,0],hrUA:[1.05,0,-.12],hrLA:[.2,0,0],hrP:[-.1,0,0],flUA:[-.2,0,.45],flLA:[-.9,0,0],flP:[.6,0,0],frUA:[-.2,0,-.45],frLA:[-.9,0,0],frP:[.6,0,0]},0),U_=new Wn([{t:0,p:Zt({})},{t:.3,p:Zt({frUA:[-1.6,0,-.7],frLA:[-.8,0,0],spine:[0,-.25,0],head:[.1,.3,0],neck:[0,.2,0]})},{t:.48,p:Zt({frUA:[-.6,0,.35],frLA:[-.1,0,0],spine:[.1,.35,0],head:[.2,-.2,0],neck:[0,-.2,0]})},{t:.85,p:Zt({})}]),z_=new Wn([{t:0,p:Zt({})},{t:.35,p:Zt({frUA:[-.4,0,-1.4],frLA:[-1.2,0,0],spine:[0,-.35,0],neck:[0,.2,0]})},{t:.52,p:Zt({frUA:[-1.3,0,.3],frLA:[-.3,0,0],spine:[.15,.4,0],neck:[.2,-.3,0]})},{t:.95,p:Zt({})}]),F_=new Wn([{t:0,p:Zt({})},{t:.08,p:Zt({neck:[-.5,.4,.2],head:[-.3,.3,.3],spine:[-.1,.1,0]})},{t:.5,p:Zt({})}]);class B_{constructor(){b(this,"root",new Ie);b(this,"j",{});b(this,"mixer");b(this,"mouthSocket",new _e);b(this,"beardSocket",new _e);b(this,"headCenter",new _e);b(this,"speed",0);b(this,"hold","none");b(this,"roar",0);b(this,"holdW",{none:0,rear:0,carry:0,down:0});b(this,"phase",0);b(this,"time",0);b(this,"locoW",0);b(this,"runW",0);b(this,"action",null);b(this,"lookTarget",null);b(this,"look",new ct);b(this,"deathT",-1);b(this,"ground");b(this,"onFootfall");b(this,"lastStep",0);this.build(),this.mixer=new W0(this.j)}build(){const t=new dt(.12,.068,.03),e=new dt(.5,.33,.15),n=new dt(.08,.05,.028),i=new dt(.38,.25,.13),s=wo(t,e,.07,190,!1),o=wo(t,e,.075,190,!0),a=wo(n,i,.045,220,!1),c=wo(n,i,.05,220,!0),l=new Ns({color:788486,roughness:.25,clearcoat:.6}),h=new Ns({color:1182212,roughness:.05,clearcoat:1}),d=new de({color:13352870,roughness:.4}),f=new de({color:3804684,roughness:.6}),u=new de({color:15260864,roughness:.35}),m=new de({color:10111562,roughness:.5}),v=(M,S,k,N,z)=>{const H=new Ie;return H.position.set(k,N,z),S.add(H),this.j[M]=H,H},p=(M,S,k,N,z=!0)=>{const H=S.clone();H.deleteAttribute("uv"),H.deleteAttribute("normal");const L=$o(H);L.computeVertexNormals();const V=new Ht(L,k);if(V.castShadow=!0,V.receiveShadow=!0,M.add(V),z){const O=new Ii(L,N,hl),P=new Dt;for(let B=0;B<hl;B++)O.setMatrixAt(B,P);O.castShadow=!1,O.receiveShadow=!0,O.frustumCulled=!1,M.add(O)}return V},g=(M,S,k)=>{const N=new Ht(S,k);return N.castShadow=!0,M.add(N),N},x=v("pelvis",this.root,0,.82,-.5),_=v("spine",x,0,.06,.55),y=v("neck",_,0,.1,.42),w=v("head",y,0,-.02,.26);w.scale.setScalar(1.22);const T=v("jaw",w,0,-.07,.04);p(x,zn([on(.36,.38,.46,0,0,.2)]),s,o),p(_,zn([on(.4,.44,.44,0,0,.05),on(.26,.2,.3,0,.3,-.02)]),s,o),p(y,zn([on(.27,.3,.3,0,-.02,.05)]),s,o);const R=on(.235,.205,.23,0,.02,0,28,20);{const M=R.getAttribute("position");for(let S=0;S<M.count;S++){const k=M.getX(S),N=M.getY(S),z=M.getZ(S),H=Bt.smoothstep(-N+.02,-.05,.12);M.setX(S,k*(1+.18*H)),z>.1&&N>.02&&M.setZ(S,z-(z-.1)*.35)}}p(w,zn([R]),s,o);const E=zn([on(.1,.088,.17,0,-.035,.22)]);p(w,E,a,c,!1),g(w,on(.05,.036,.034,0,-.01,.385,16,12),l);for(const M of[1,-1])p(w,zn([on(.068,.07,.03,.16*M,.2,-.03)]),s,o),g(w,on(.019,.019,.013,.095*M,.075,.19,12,10),h);g(T,on(.08,.034,.15,0,-.016,.19),a),g(w,on(.08,.05,.14,0,-.08,.2),f),g(T,on(.055,.016,.11,0,.012,.18),m);for(const M of[1,-1]){const S=new Rr(.009,.035,8);S.rotateX(Math.PI),S.translate(.046*M,-.09,.31),g(w,S,u);const k=new Rr(.008,.03,8);k.translate(.042*M,.03,.28),g(T,k,u)}this.headCenter.position.set(0,.02,.1),w.add(this.headCenter),this.mouthSocket.position.set(0,-.07,.27),w.add(this.mouthSocket),this.beardSocket.position.set(0,-.14,.12),w.add(this.beardSocket),p(T,zn([on(.1,.07,.1,0,-.06,.06)]),s,o);const D=[["fl",_,.22,-.2,.2,.42,.36],["fr",_,-.22,-.2,.2,.42,.36],["hl",x,.2,-.12,.08,.42,.38]];D.push(["hr",x,-.2,-.12,.08,.42,.38]);for(const[M,S,k,N,z,H,L]of D){const V=v(M+"UA",S,k,N,z),O=v(M+"LA",V,0,-H,0),P=v(M+"P",O,0,-L+.02,0);p(V,zn([Nu(H,.15,.1)]),s,o),p(O,zn([Nu(L,.1,.085)]),a,c),g(P,zn([on(.095,.05,.13,0,-.03,.05)]),a);for(let B=0;B<5;B++){const G=new Rr(.009,.06,6);G.rotateX(Math.PI/2+.5),G.translate((B-2)*.034,-.05,.19+(B===0||B===4?-.015:0)),g(P,G,d)}}p(x,zn([on(.05,.05,.06,0,.14,-.28)]),s,o)}play(t,e=[]){const n=t==="swipe"?U_:t==="swipeHigh"?z_:F_;this.action={clip:n,t:0,events:e.map(i=>({...i,fired:!1}))}}get busy(){return!!this.action}update(t){this.time+=t;const e=this.mixer;e.reset();const n=this.speed;this.locoW=ue(this.locoW,Me(n/1,0,1),6,t),this.runW=ue(this.runW,Me((n-2.5)/3,0,1),4,t);const i=Bt.lerp(1.6,3.2,this.runW);this.phase+=Math.PI*2*n*t/i;const s=this.phase,o=Bt.lerp(.42,.75,this.runW)*this.locoW,a={hl:0,fl:Bt.lerp(.25,0,this.runW),hr:Bt.lerp(.5,.08,this.runW),fr:Bt.lerp(.75,.1,this.runW)};this.runW>.01&&(a.hl=Bt.lerp(0,.55,this.runW),a.hr=Bt.lerp(.5,.62,this.runW));const c={};for(const f of["fl","fr","hl","hr"]){const u=s+a[f]*Math.PI*2,m=Math.sin(u),v=Math.cos(u),p=f[0]==="f";c[f+"UA"]=[-m*o,0,0];const g=Math.max(0,v)*(p?1.1:.8)*this.locoW;c[f+"LA"]=[p?g:g*.6,0,0],c[f+"P"]=[p?-g*.5:.2*g,0,0]}const l=Math.sin(this.time*1.6)*.02;c.pelvis=[0,Math.sin(s)*.05*this.locoW,0],c.spine=[Math.sin(s*2)*.03*this.locoW+Math.sin(s)*.12*this.runW+l,-Math.sin(s)*.06*this.locoW,0],c.neck=[-.05+Math.sin(s*2)*.05*this.locoW+.15*(1-this.locoW),Math.sin(this.time*.3)*.2*(1-this.locoW),0],c.head=[.1+Math.sin(s*2+1)*.05*this.locoW,0,0],c.jaw=[0,0,0],e.layer({r:c,hipsY:0},1),this.root.position.y+=0;for(const f of Object.keys(this.holdW))this.holdW[f]=ue(this.holdW[f],this.hold===f?1:0,f==="rear"?3.2:5,t);if(this.holdW.carry>.001&&e.layer(Zt({neck:[-.35,0,0],head:[.25,0,0],jaw:[.35,0,0]}),this.holdW.carry,["neck","head","jaw"]),this.holdW.rear>.001&&(e.layer(N_,this.holdW.rear),e.add("flUA",Math.sin(this.time*2.2)*.12*this.holdW.rear,0,0),e.add("frUA",Math.sin(this.time*2.2+1.5)*.12*this.holdW.rear,0,0)),this.action){const f=this.action;f.t+=t;const u=Math.min(1,f.t/.08,(f.clip.duration-f.t)/.15);e.layer(f.clip.sample(f.t,{r:{}}),Math.max(0,u));for(const m of f.events)!m.fired&&f.t>=m.t&&(m.fired=!0,m.fn());f.t>=f.clip.duration&&(this.action=null)}if(this.roar>.001&&(e.add("jaw",this.roar*.75,0,0),e.add("head",-this.roar*.25,Math.sin(this.time*18)*.06*this.roar,0),e.add("neck",-this.roar*.15,0,0)),this.lookTarget){const f=this.root.worldToLocal(O_.copy(this.lookTarget)),u=Me(Math.atan2(f.x,f.z),-.9,.9);this.look.x=ue(this.look.x,u,4,t)}else this.look.x=ue(this.look.x,0,3,t);if(e.add("neck",0,this.look.x*.5,0),e.add("head",0,this.look.x*.4,0),this.holdW.down>.001){const f=this.holdW.down;e.layer(Zt({neck:[.3,0,.3],head:[.2,0,.4],jaw:[.2,0,0],flUA:[-.3,0,.9],frUA:[-.2,0,.6],hlUA:[-.3,0,.8],hrUA:[-.2,0,.5],flLA:[.4,0,0],frLA:[.6,0,0]}),f)}e.apply();const h=Math.sin(s);Math.sign(h)!==this.lastStep&&this.locoW>.5&&this.onFootfall?.(),this.lastStep=Math.sign(h);const d=this.holdW.down;this.j.pelvis.position.y=.82-d*.45+this.holdW.rear*.08,this.j.pelvis.rotation.z=d*1.35,this.root.updateMatrixWorld(!0)}hitPoints(t){return t[0]=this.j.pelvis.localToWorld((t[0]??new A).set(0,0,.2)),t[1]=this.j.spine.localToWorld((t[1]??new A).set(0,.05,.05)),t[2]=this.headCenter.getWorldPosition(t[2]??new A),t}}const O_=new A;class H_{constructor(t,e,n){b(this,"model",new B_);b(this,"pos",new A);b(this,"heading",0);b(this,"speed",0);b(this,"pitch",0);b(this,"alive",!0);b(this,"hits",0);this.terrain=t,this.colliders=e,n.add(this.model.root),this.model.root.visible=!1,this.model.ground=(i,s)=>t.heightAt(i,s)}get visible(){return this.model.root.visible}set visible(t){this.model.root.visible=t}place(t,e,n){this.pos.set(t,this.terrain.heightAt(t,e),e),this.heading=n,this.speed=0}moveTo(t,e,n,i=.8){const s=t.x-this.pos.x,o=t.z-this.pos.z;return Math.hypot(s,o)<i?(this.speed=ue(this.speed,0,5,n),!0):(this.heading=Ls(this.heading,Math.atan2(s,o),4.5,n),this.speed=ue(this.speed,e,2.5,n),!1)}face(t,e,n=4){this.heading=Ls(this.heading,Math.atan2(t.x-this.pos.x,t.z-this.pos.z),n,e)}stop(t){this.speed=ue(this.speed,0,4,t)}update(t){this.speed>.01&&(this.pos.x+=Math.sin(this.heading)*this.speed*t,this.pos.z+=Math.cos(this.heading)*this.speed*t,this.colliders.resolve(this.pos,.6)),this.pos.y=this.terrain.heightAt(this.pos.x,this.pos.z);const e=Math.sin(this.heading),n=Math.cos(this.heading),i=this.terrain.heightAt(this.pos.x+e*.8,this.pos.z+n*.8),s=this.terrain.heightAt(this.pos.x-e*.8,this.pos.z-n*.8);this.pitch=ue(this.pitch,-Math.atan2(i-s,1.6)*(this.model.hold==="rear"?0:1),6,t);const o=this.model.root;o.position.copy(this.pos),o.position.y=Math.min(i,s,this.pos.y),o.rotation.set(0,0,0),o.rotateY(this.heading),o.rotateX(this.pitch),this.model.speed=this.speed,this.visible&&this.model.update(t)}}class V_{constructor(t,e,n,i){b(this,"group",new Ie);b(this,"alive",!0);b(this,"center",new A);b(this,"shards",[]);b(this,"t",0);this.mat=t,this.ground=e;const s=[],o=[[0,0],[.09,0],[.15,.08],[.18,.2],[.17,.32],[.12,.42],[.075,.47],[.07,.53],[.09,.56],[.075,.57]];for(const[l,h]of o)s.push(new ct(l,h));const a=new fi(s,24),c=new Ht(a,t);c.castShadow=!0,c.receiveShadow=!0;for(const l of[1,-1]){const h=new Ht(new Is(.05,.012,6,12,Math.PI),t);h.position.set(.12*l,.4,0),h.rotation.set(0,0,l>0?-Math.PI/2:Math.PI/2),c.add(h)}this.group.add(c),this.group.position.copy(n),this.group.scale.setScalar(i),this.center.copy(n).add(new A(0,.28*i,0))}shatter(t){if(!this.alive)return;this.alive=!1;const e=this.group.children[0];e.visible=!1;const n=Gn(Math.floor(Math.random()*1e6));for(let i=0;i<16;i++){const s=new ge,o=.05+n()*.06,a=new Float32Array([0,0,0,o,n()*.02,n()*o*.4,n()*o*.5,o*.9,n()*.02]);s.setAttribute("position",new te(a,3)),s.computeVertexNormals();const c=new Ht(s,this.mat);c.material.side=cn,c.castShadow=!0,c.position.set((n()-.5)*.25,.1+n()*.4,(n()-.5)*.25),this.group.add(c);const l=new A(n()-.5,n()*.8+.3,n()-.5).normalize();this.shards.push({m:c,v:l.multiplyScalar(1.5+n()*2.5).addScaledVector(t.clone().normalize(),1.2),w:new A(n()*12,n()*12,n()*12)})}}reset(){this.alive=!0,this.group.children[0].visible=!0;for(const t of this.shards)this.group.remove(t.m),t.m.geometry.dispose();this.shards=[],this.t=0}update(t){if(this.alive)return;this.t+=t;const e=this.group.position,n=this.group.scale.x;for(const i of this.shards){if(i.v.lengthSq()<.001)continue;i.v.y-=9.8*t,i.m.position.addScaledVector(i.v,t/n),i.m.rotation.x+=i.w.x*t,i.m.rotation.y+=i.w.y*t;const s=e.y+i.m.position.y*n,o=this.ground(e.x+i.m.position.x*n,e.z+i.m.position.z*n);s<o+.01&&(i.m.position.y=(o+.01-e.y)/n,i.v.multiplyScalar(.3),i.v.y=Math.abs(i.v.y)*.3,i.w.multiplyScalar(.5),Math.abs(i.v.y)<.2&&i.v.set(0,0,0))}}}class G_{constructor(t,e,n,i){b(this,"mesh");b(this,"glint");b(this,"beacon");b(this,"taken",!1);const s=new Xe(.075,18,12);s.scale(1.25,.62,.95),this.mesh=new Ht(s,e),this.mesh.position.copy(t).add(new A(0,.035,0)),this.mesh.rotation.y=Math.random()*6,this.mesh.castShadow=!0,this.glint=new Ht(new Ll(.26,.34,40),n),this.glint.rotation.x=-Math.PI/2,this.glint.position.copy(t).add(new A(0,.06,0)),this.glint.renderOrder=4,this.beacon=new av(i),this.beacon.position.copy(t).add(new A(0,.55,0)),this.beacon.scale.setScalar(.55),this.beacon.renderOrder=7}setVisible(t){this.mesh.visible=t,this.glint.visible=t,this.beacon.visible=t}}function W_(){const r=document.createElement("canvas");r.width=r.height=64;const t=r.getContext("2d"),e=t.createRadialGradient(32,32,0,32,32,32);e.addColorStop(0,"rgba(255,248,225,1)"),e.addColorStop(.18,"rgba(255,226,160,0.85)"),e.addColorStop(.5,"rgba(255,200,120,0.18)"),e.addColorStop(1,"rgba(255,200,120,0)"),t.fillStyle=e,t.fillRect(0,0,64,64),t.globalCompositeOperation="lighter",t.fillStyle="rgba(255,245,215,0.7)",t.fillRect(31,4,2,56),t.fillRect(4,31,56,2);const n=new pv(r);return n.colorSpace=Mn,n}class q_{constructor(t,e,n){b(this,"group",new Ie);b(this,"jars",[]);b(this,"stones",[]);b(this,"glintMat");b(this,"beaconMat");const i=(x,_)=>t.heightAt(x,_),s=Xt.targets,o=zl(e,15129803),a=Ul(12,2),c=new Ii(a,o,26),l=new Dt,h=new A(1,0,.35).normalize(),d=Gn(88);let f=0;for(let x=0;x<13;x++)for(let _=0;_<2;_++){const y=(x-6)*.42+(_?.2:0),w=s.x+h.x*y,T=s.z+h.z*y,R=i(w,T)+_*.32+.12,E=.26+d()*.08;l.compose(new A(w,R,T),new De().setFromEuler(new Ve(d(),d()*6,d()*.3)),new A(E*1.3,E,E)),c.setMatrixAt(f++,l)}c.castShadow=c.receiveShadow=!0,this.group.add(c);for(let x=-5;x<=5;x+=2)n.add({x:s.x+h.x*x*.42,z:s.z+h.z*x*.42,r:.45,tag:"wall"});const u=new de({color:11822138,roughness:.82});for(const x of[-1.9,0,1.9]){const _=s.x+h.x*x,y=s.z+h.z*x,w=i(_,y)+.66,T=new V_(u,i,new A(_,w,y),.9+Math.random()*.2);this.jars.push(T),this.group.add(T.group)}const m=Xt.stones,v=new de({color:15525592,roughness:.28});this.glintMat=new ea({color:16769696,transparent:!0,opacity:0,depthWrite:!1,depthTest:!1}),this.beaconMat=new E0({map:W_(),color:16777215,transparent:!0,opacity:0,depthWrite:!1,blending:Uo});const p=[[0,0],[3.5,-1.2],[-2.8,1.6],[6.5,1.8],[-5.8,-.8]],g=[];for(const[x,_]of p){let y=null;for(let R=0;R<10&&!y;R+=.5)for(let E=0;E<Math.PI*2&&!y;E+=Math.PI/6){const D=m.x+x+Math.cos(E)*R,M=m.z+_+Math.sin(E)*R;n.free(D,M,1.4)&&(t.slopeAt(D,M)>.35||g.some(S=>Math.hypot(S.x-D,S.z-M)<1.8)||(y=new A(D,i(D,M),M)))}const w=y??new A(m.x+x,i(m.x+x,m.z+_),m.z+_);g.push(w);const T=new G_(w,v,this.glintMat,this.beaconMat);this.stones.push(T),this.group.add(T.mesh,T.glint,T.beacon)}}reset(){for(const t of this.jars)t.reset();for(const t of this.stones)t.taken=!1,t.setVisible(!0)}setStoneGlint(t,e){this.glintMat.opacity=t?.4+.25*Math.sin(e*4):0,this.beaconMat.opacity=t?.55+.35*Math.sin(e*3.1):0,this.beaconMat.rotation=e*.6}update(t){for(const e of this.jars)e.update(t)}}class X_{constructor(t,e){b(this,"yaw",Math.PI);b(this,"pitch",.12);b(this,"dist",3.6);b(this,"curDist",3.6);b(this,"aim",0);b(this,"aimW",0);b(this,"shake",0);b(this,"shakeT",0);b(this,"target",new A);b(this,"smoothTarget",new A);b(this,"shots",[]);b(this,"shotT",0);b(this,"shotTotal",0);b(this,"onShotsDone");b(this,"mode","follow");b(this,"blendFromCine",0);b(this,"lastCine",null);b(this,"fov",50);b(this,"sensitivity",.0024);b(this,"initialized",!1);this.camera=t,this.ground=e}addShake(t){this.shake=Math.max(this.shake,t)}playShots(t,e){this.shots=t,this.shotT=0,this.shotTotal=t.reduce((n,i)=>n+i.duration,0),this.mode="cinematic",this.onShotsDone=e}get inCinematic(){return this.mode==="cinematic"}stop(){this.shots=[],this.onShotsDone=void 0,this.mode="follow",this.blendFromCine=0,this.initialized=!1}skipShots(){this.mode==="cinematic"&&(this.shotT=this.shotTotal)}snapBehind(t,e=.12){this.yaw=t+Math.PI,this.pitch=e,this.initialized=!1}applyLook(t,e){this.yaw-=t*this.sensitivity,this.pitch=Me(this.pitch+e*this.sensitivity,-.55,.9)}update(t,e){const n=this.camera;if(this.mode==="cinematic"){this.shotT+=t;let u=this.shotT,m=null;for(const v of this.shots){if(u<=v.duration){let p=u/v.duration;v.ease!==!1&&(p=p*p*(3-2*p)),m=v.at(p,u);break}u-=v.duration}if(m){this.lastCine={pos:m.pos.clone(),look:m.look.clone(),fov:m.fov??50},n.position.copy(m.pos),n.up.set(0,1,0),n.lookAt(m.look),m.roll&&n.rotateZ(m.roll),this.fov=m.fov??50,this.applyShake(t,e);return}else{const v=this.onShotsDone;if(this.mode="follow",this.blendFromCine=1,this.onShotsDone=void 0,v?.(),this.mode==="cinematic")return}}this.aimW=ue(this.aimW,this.aim,10,t),this.initialized||(this.smoothTarget.copy(this.target),this.initialized=!0),this.smoothTarget.x=ue(this.smoothTarget.x,this.target.x,14,t),this.smoothTarget.z=ue(this.smoothTarget.z,this.target.z,14,t),this.smoothTarget.y=ue(this.smoothTarget.y,this.target.y,8,t);const i=Bt.lerp(this.dist,1.9,this.aimW),s=Math.cos(this.pitch),o=Math.sin(this.pitch),a=j_.set(Math.sin(this.yaw)*s,o,Math.cos(this.yaw)*s),c=Y_.set(-Math.cos(this.yaw),0,Math.sin(this.yaw)),l=$_.copy(this.smoothTarget).addScaledVector(c,-.62*this.aimW);l.y+=.08*this.aimW;let h=i;for(let u=1;u<=8;u++){const m=u/8*i,v=l.x+a.x*m,p=l.z+a.z*m;if(l.y+a.y*m<this.ground(v,p)+.35){h=Math.max(.6,m-.3);break}}this.curDist=h<this.curDist?h:ue(this.curDist,h,4,t);const d=K_.copy(l).addScaledVector(a,this.curDist);d.y=Math.max(d.y,this.ground(d.x,d.z)+.35);const f=Z_.copy(l).addScaledVector(a,-4);if(this.blendFromCine>0&&this.lastCine){this.blendFromCine=Math.max(0,this.blendFromCine-t/1.2);const u=this.blendFromCine*this.blendFromCine*(3-2*this.blendFromCine);d.lerp(this.lastCine.pos,u),f.lerp(this.lastCine.look,u)}n.position.copy(d),n.up.set(0,1,0),n.lookAt(f),this.fov=Bt.lerp(52,44,this.aimW),this.applyShake(t,e)}applyShake(t,e){if(this.shake>.001){this.shakeT+=t;const n=this.shake;this.camera.rotateX((Math.sin(e*37)+Math.sin(e*23))*.006*n),this.camera.rotateY((Math.sin(e*29+1)+Math.sin(e*41))*.006*n),this.camera.position.y+=Math.sin(e*31)*.02*n,this.shake=Math.max(0,this.shake-t*2.2)}}forward(t=new A){return t.set(-Math.sin(this.yaw),0,-Math.cos(this.yaw))}}const j_=new A,Y_=new A,$_=new A,K_=new A,Z_=new A,To=(r,t,e)=>new A(r,t,e);function sc(r,t,e,n,i,s=45,o=s){return{duration:r,at:a=>({pos:t.clone().lerp(e,a),look:n.clone().lerp(i,a),fov:Bt.lerp(s,o,a)})}}function rc(r,t,e,n,i,s,o,a,c,l=40){return{duration:r,at:h=>{const d=t(),f=Bt.lerp(e,n,h),u=Bt.lerp(i,s,h),m=Bt.lerp(o,a,h);return{pos:new A(d.x+Math.sin(u)*f,d.y+m,d.z+Math.cos(u)*f),look:new A(d.x,d.y+c,d.z),fov:l}}}}const Pn=Math.PI*2,Re=(r,t,e)=>r<t?t:r>e?e:r,Xn=(r,t,e)=>r+(t-r)*e,J_=(r,t,e)=>r*Math.pow(t/r,e),et=(r,t)=>r+Math.random()*(t-r),Qn=(r,t)=>Math.floor(r+Math.random()*(t-r+1)),je=r=>Math.random()<r,Be=()=>Math.random()*2-1,Ci=r=>440*Math.pow(2,(r-69)/12),ca=r=>((r-2)%12+12)%12,Rn=(r,t)=>typeof r=="number"&&Number.isFinite(r)?r:t;function wn(r){return r[Math.floor(Math.random()*r.length)]}function Eo(r,t,e,n,i){return r.setValueAtTime(0,t),r.linearRampToValueAtTime(n,t+e),r.setTargetAtTime(0,t+e,i),t+e+i*7}function un(r,t,e,n,i=1){r.setValueAtTime(n[0][1]*i,t);for(let s=1;s<n.length;s++)r.linearRampToValueAtTime(n[s][1]*i,t+n[s][0]*e)}function gr(r,t,e,n){typeof r.cancelAndHoldAtTime=="function"?r.cancelAndHoldAtTime(e):r.cancelScheduledValues(e),r.setTargetAtTime(t,e,Math.max(.005,n/4))}class oc{constructor(t=64){b(this,"v",[]);this.n=t;for(let e=0;e<t;e++)this.v.push(Math.random())}at(t){const e=Math.floor(t),n=t-e,i=this.v[(e%this.n+this.n)%this.n],s=this.v[((e+1)%this.n+this.n)%this.n];return i+(s-i)*n*n*(3-2*n)}}const Ks={Dm:[0,3,7],D:[0,4,7],Eb:[1,5,8],F:[3,7,10],G:[5,9,0],Gm:[5,8,0],A:[7,11,2],Am:[7,10,2],Bb:[8,0,3],Bm:[9,0,4],C:[10,2,5],Cm:[10,1,5],Em:[2,5,9]},Xl={dorian:[0,2,3,5,7,9,10],aeolian:[0,2,3,5,7,8,10],mixolydian:[0,2,4,5,7,9,10]};function gi(r,t,e){const n=[];for(let i=t;i<=e;i++)r.includes(ca(i))&&n.push(i);return n}function la(r,t){let e=t;for(;ca(e)!==r[0];)e++;return e}function Q_(r,t,e){const n=[];for(let i=t;i<=e;i++)r.includes(ca(i))&&n.push(i);return n}function ty(r,t,e){const n=Math.floor(e/7);return t+r[(e%7+7)%7]+12*n}function Uu(r,t,e){for(let n=0;n<r.length;n++)for(const i of[t-n,t+n])if(i>=0&&i<r.length&&e.includes(ca(r[i])))return i;return t}const os=r=>Re((r-66)/22,-.55,.55),zu={ah:[720,1120,2600],oh:[520,860,2450],oo:[340,800,2300],eh:[560,1800,2550]};class ye{constructor(t,e,n,i,s=0){b(this,"b0",1);b(this,"b1",0);b(this,"b2",0);b(this,"a1",0);b(this,"a2",0);b(this,"x1",0);b(this,"x2",0);b(this,"y1",0);b(this,"y2",0);const o=Pn*Re(e,5,i*.49)/i,a=Math.cos(o),c=Math.sin(o)/(2*n),l=Math.pow(10,s/40);let h=1,d=0,f=0,u=1,m=-2*a,v=1;switch(t){case"lp":h=(1-a)/2,d=1-a,f=h,u=1+c,v=1-c;break;case"hp":h=(1+a)/2,d=-(1+a),f=h,u=1+c,v=1-c;break;case"bp":h=c,d=0,f=-c,u=1+c,v=1-c;break;case"peak":h=1+c*l,d=-2*a,f=1-c*l,u=1+c/l,v=1-c/l;break}this.b0=h/u,this.b1=d/u,this.b2=f/u,this.a1=m/u,this.a2=v/u}run(t){const e=this.b0*t+this.b1*this.x1+this.b2*this.x2-this.a1*this.y1-this.a2*this.y2;return this.x2=this.x1,this.x1=t,this.y2=this.y1,this.y1=e,e}}function Hn(r,t,e,n,i=.9,s=0){const o=s||r.sampleRate,a=Math.max(16,Math.floor(t*o)),c=r.createBuffer(e,a,o),l=[];for(let u=0;u<e;u++)l.push(c.getChannelData(u));n(l,o,a);let h=0;for(const u of l)for(let m=0;m<a;m++){const v=u[m];Number.isFinite(v)?Math.abs(v)>h&&(h=Math.abs(v)):u[m]=0}const d=i>0&&h>0?i/h:1,f=Math.min(a,Math.floor(o*.008));for(const u of l){if(d!==1)for(let m=0;m<a;m++)u[m]*=d;for(let m=0;m<f;m++)u[a-1-m]*=m/f}return c}function ac(r,t,e,n){const i=r.sampleRate,s=Math.floor(e*i),o=Math.floor(i*.2),a=r.createBuffer(n,s,i);for(let c=0;c<n;c++){const l=new Float32Array(s+o);let h=0,d=0,f=0,u=0,m=0,v=0,p=0,g=0;for(let w=0;w<l.length;w++){const T=Be();t==="white"?l[w]=T:t==="pink"?(h=.99886*h+T*.0555179,d=.99332*d+T*.0750759,f=.969*f+T*.153852,u=.8665*u+T*.3104856,m=.55*m+T*.5329522,v=-.7616*v-T*.016898,l[w]=h+d+f+u+m+v+p+T*.5362,p=T*.115926):(g=(g+.02*T)/1.02,l[w]=g)}let x=0;for(let w=0;w<l.length;w++)x+=l[w]*l[w];const _=.25/Math.sqrt(x/l.length||1),y=a.getChannelData(c);for(let w=0;w<s;w++)y[w]=(w<o?l[w]*Math.sqrt(w/o)+l[s+w]*Math.sqrt(1-w/o):l[w])*_}return a}function ey(r,t,e){return Hn(r,t+e,2,(n,i,s)=>{const o=Math.floor(e*i),a=Math.exp(-6.9/(t*i)),c=Math.exp(-1/(.008*i));for(let l=0;l<2;l++){const h=n[l];let d=0,f=0,u=1,m=1,v=1;for(let p=o;p<s;p++){if((p-o)%64===0){const g=(p-o)/i/t,x=250+8500*Math.pow(.08,g);f=Math.exp(-Pn*x/i),u=Math.sqrt((1+f)/(1-f))}d=(1-f)*Be()+f*d,h[p]=d*u*m*(1-v),m*=a,v*=c}for(let p=0;p<12;p++){const g=et(.008,.08),x=o+Math.floor(g*i);if(x+2<s){const _=(je(.5)?1:-1)*et(.5,1.2)*(1-g/.1);h[x]+=_,h[x+1]+=_*.5,h[x+2]+=_*.2}}}},.9)}function jl(r,t,e,n,i,s,o,a,c,l,h,d,f){for(let u=0;u<e;u++){const m=Math.pow(Math.random(),1.5)*i,v=Math.floor((n+m)*t),p=Math.max(8,Math.floor(et(l,h)*t)),g=new ye("bp",et(s,o),et(.9,2.2),t),x=et(a,c)*Math.exp(-m/d)*3.5;for(let _=0;_<p;_++){const y=v+_;if(y>=r.length)break;const w=g.run(Be())*Math.sin(Math.PI*_/p)*x;r[y]+=w}}}const cc=r=>{const t=r<-3?-3:r>3?3:r;return t*(27+t*t)/(27+9*t*t)},oe=(r,t)=>Math.exp(-1/(r*t));function vr(r,t){switch(t){case"dum":{const e=et(62,74),n=et(45,65),i=et(.18,.26),s=et(900,1400);return Hn(r,.75,1,(o,a,c)=>{const l=o[0],h=new ye("lp",s,.7,a),d=oe(.026,a),f=oe(i,a),u=oe(.06,a),m=oe(.012,a),v=oe(.0012,a);let p=1,g=1,x=1,_=1,y=1,w=0,T=0;for(let R=0;R<c;R++){const E=e+n*p;w+=Pn*E/a,T+=Pn*E*1.58/a;const D=Math.sin(w)*g+.3*Math.sin(T)*x+h.run(Be())*1.6*_;l[R]=cc(1.5*D*(1-y)),p*=d,g*=f,x*=u,_*=m,y*=v}})}case"tek":case"ka":{const e=t==="tek",n=e?et(2600,3600):et(1800,2500),i=e?et(400,470):et(320,380);return Hn(r,e?.25:.18,1,(s,o,a)=>{const c=s[0],l=new ye("bp",n,e?1.3:1,o),h=new ye("hp",e?250:200,.7,o),d=oe(e?.018:.011,o),f=oe(e?.035:.02,o),u=oe(.02,o),m=oe(e?4e-4:5e-4,o);let v=1,p=1,g=1,x=1;const _=Pn*i/o,y=Pn*i*2.72/o;for(let w=0;w<a;w++){const T=l.run(Be())*(e?2.6:2)*v+(e?.45:.3)*Math.sin(_*w)*p+(e?.2*Math.sin(y*w)*g:0);c[w]=h.run(T*(1-x)),v*=d,p*=f,g*=u,x*=m}})}case"taiko":{const e=et(58,66),n=et(60,90),i=et(.36,.48);return Hn(r,1.8,1,(s,o,a)=>{const c=s[0],l=new ye("lp",420,.8,o),h=new ye("bp",1800,.9,o),d=new ye("bp",et(230,290),2.5,o),f=oe(.035,o),u=oe(i,o),m=oe(.2,o),v=oe(.1,o),p=oe(.035,o),g=oe(.005,o),x=oe(.07,o),_=oe(.0018,o);let y=1,w=1,T=1,R=1,E=1,D=1,M=1,S=1,k=0,N=0,z=0;for(let H=0;H<a;H++){const L=Pn*(e+n*y)/o;k+=L,N+=L*1.51,z+=L*2.28;const V=Be(),O=Math.sin(k)*w+.45*Math.sin(N)*T+.22*Math.sin(z)*R+l.run(V)*3*E+h.run(V)*.6*D+d.run(V)*4*M;c[H]=cc(1.7*O*(1-S)),y*=f,w*=u,T*=m,R*=v,E*=p,D*=g,M*=x,S*=_}},.95,24e3)}case"boom":return Hn(r,3.6,1,(e,n,i)=>{const s=e[0],o=new ye("lp",160,.7,n),a=new ye("lp",160,.7,n),c=new ye("hp",700,.7,n),l=oe(.14,n),h=oe(1,n),d=oe(.6,n),f=oe(.02,n),u=oe(.003,n);let m=1,v=1,p=1,g=1,x=1,_=0;for(let y=0;y<i;y++){_+=Pn*(27+58*m)/n;const w=Be(),T=Math.sin(_)*v+a.run(o.run(w))*7*p+c.run(w)*.5*g;s[y]=cc(1.3*T*(1-x)),m*=l,v*=h,p*=d,g*=f,x*=u}},.95,24e3)}}function Fu(r,t){return Hn(r,t?.36:.3,1,(e,n,i)=>{const s=e[0],o=new ye("lp",et(120,200)*(t?1.25:1),.9,n),a=new ye("bp",et(1800,3200),.6,n),c=t?.026:.038,l=t?et(.05,.08):et(.035,.055),h=oe(.0025,n),d=oe(c,n),f=oe(l,n);let u=1,m=1,v=1;const p=t?.7:.45;for(let x=0;x<i;x++)s[x]=(o.run(Be())*9*m+a.run(Be())*p*v)*(1-u),u*=h,m*=d,v*=f;if(jl(s,n,t?Qn(16,28):Qn(8,15),.002,t?.1:.07,1200,t?6500:5e3,.25,.9,.0012,.006,t?.07:.05),t){const x=new ye("bp",et(1200,2e3),.8,n),_=Math.floor(.03*n),y=Math.min(i,Math.floor(.22*n));for(let w=_;w<y;w++)s[w]+=x.run(Be())*.5*Math.sin(Math.PI*(w-_)/(y-_))}const g=new ye("hp",45,.7,n);for(let x=0;x<i;x++)s[x]=g.run(s[x])},t?.9:.8)}function ny(r){return Hn(r,.5,1,(t,e,n)=>{const i=t[0],s=new ye("bp",et(1100,1700),.7,e),o=new ye("lp",250,.8,e),a=oe(.02,e),c=oe(.14,e);let l=1,h=1,d=1;for(let f=0;f<n;f++)f%256===0&&(d=et(.6,1)),i[f]=(s.run(Be())*.9+o.run(Be())*4)*(1-l)*h*d,l*=a,h*=c;jl(i,e,Qn(25,40),0,.3,1500,6e3,.15,.6,.001,.005,.2)},.85)}function iy(r){return Hn(r,.5,1,(t,e)=>{jl(t[0],e,Qn(6,12),0,.35,2e3,7e3,.2,.8,8e-4,.004,.2)},.8)}function sy(r){return Hn(r,1.5,2,(t,e,n)=>{const[i,s]=t,o=new ye("bp",et(2e3,3e3),.7,e),a=new ye("lp",900,.7,e),c=et(260,420),l=Math.min(n,Math.floor(.3*e)),h=oe(.012,e),d=oe(.03,e),f=oe(.045,e),u=oe(.02,e),m=oe(7e-4,e);let v=1,p=1,g=1,x=1,_=1;const y=Pn*c/e,w=Pn*c*2.37/e;for(let L=0;L<l;L++){const V=Be(),O=(o.run(V)*1.6*v+a.run(V)*2*p+Math.sin(y*L)*.5*g+Math.sin(w*L)*.25*x)*(1-_);i[L]+=O,s[L]+=O,v*=h,p*=d,g*=f,x*=u,_*=m}const T=Qn(16,28),R=[1,1.58,2.41],E=[1,.6,.4],D=[1,.6,.35];for(let L=0;L<T;L++){const V=L<7?et(.002,.05):.05+Math.pow(Math.random(),1.7)*.9,O=Math.random(),P=Xn(1600,7e3,O)*et(.9,1.1),B=Xn(.03,.008,O),G=et(.15,.5)*(V<.05?1:Xn(.8,.25,V/.95)),Q=et(-.8,.8),ut=Math.cos((Q+1)*Math.PI/4)*G,X=Math.sin((Q+1)*Math.PI/4)*G,Z=Math.floor(V*e),rt=Math.min(n-Z,Math.floor(B*7*e));if(rt<=2)continue;const J=new Float32Array(rt);for(let At=0;At<3;At++){const st=Pn*P*R[At]/e;if(st>=Math.PI)continue;const F=Math.exp(-1/(B*E[At]*e)),Gt=2*F*Math.cos(st),Lt=F*F,vt=Math.random()*Pn;let ft=Math.sin(vt-st)/F,Kt=Math.sin(vt-2*st)/(F*F);for(let mt=0;mt<rt;mt++){const U=Gt*ft-Lt*Kt;Kt=ft,ft=U,J[mt]+=U*D[At]}}const ot=oe(4e-4,e);let lt=1;const bt=Math.floor(.001*e);for(let At=0;At<rt;At++){let st=J[At]*(1-lt);At<bt&&(st+=Be()*.8),i[Z+At]+=st*ut,s[Z+At]+=st*X,lt*=ot}}const M=new ye("lp",2500,.5,e),S=new ye("lp",2500,.5,e),k=oe(.25,e),N=oe(.01,e);let z=.07,H=1;for(let L=0;L<n;L++){const V=z*(1-H);i[L]+=M.run(Be())*V*3,s[L]+=S.run(Be())*V*3,z*=k,H*=N}},.9)}function ry(r){return Hn(r,.55,1,(t,e,n)=>{const i=t[0],s=new Float32Array(n),o=Qn(14,26);for(let l=0;l<o;l++){const h=Math.floor(Math.pow(Math.random(),1.3)*.42*e),d=Math.floor(et(.012,.05)*e),f=et(.3,1);for(let u=0;u<d&&h+u<n;u++)s[h+u]+=f*Math.sin(Math.PI*u/d)}const a=new ye("bp",et(2200,3800),.6,e),c=new ye("bp",600,.8,e);for(let l=0;l<n;l++)i[l]=(a.run(Be())+.5*c.run(Be()))*s[l]},.8)}function oy(r,t,e){const i=Ci(t),s=.5-.2*e,o=Math.max(4,Math.floor(24e3/i-s)),a=i*(o+s)/24e3,c=Re(3.3-(t-45)*.07,1,3.3),l=Math.pow(10,-3/(i*c));return{buf:Hn(r,Math.min(c+.1,2.8),1,(d,f,u)=>{const m=d[0],v=new Float32Array(o);let p=0;const g=Xn(.3,.85,e);for(let L=0;L<o;L++)p+=g*(Be()-p),v[L]=p;const x=Math.max(1,Math.round(o*et(.12,.24)));for(let L=o-1;L>=x;L--)v[L]-=v[L-x];let _=0;for(let L=0;L<o;L++)_+=v[L];_/=o;for(let L=0;L<o;L++)v[L]-=_;for(let L=0;L<u;L++)m[L]=L<o?v[L]:l*((1-s)*m[L-o]+s*(L-o-1>=0?m[L-o-1]:0));const y=new ye("bp",3e3,.8,f),w=Math.floor(.004*f);for(let L=0;L<w;L++)m[L]+=y.run(Be())*.3*e*(1-L/w);const T=new ye("hp",70,.7,f),R=new ye("peak",240,1.1,f,4),E=new ye("peak",900,1.5,f,1.5),D=new ye("peak",2800,1.3,f,3*e),M=new ye("lp",Xn(3500,7500,e),.6,f);for(let L=0;L<u;L++)m[L]=M.run(D.run(E.run(R.run(T.run(m[L])))));const S=Math.min(u,Math.floor(.25*f));let k=0,N=0;for(let L=0;L<S;L++)k+=m[L]*m[L];for(let L=0;L<u;L++)N=Math.max(N,Math.abs(m[L]));const z=Math.min(.2/Math.sqrt(k/S||1),.95/(N||1)),H=Math.floor(.0012*f);for(let L=0;L<u;L++)m[L]*=L<H?z*L/H:z},0,24e3),rate:a}}const lc={dum:{n:3,make:r=>vr(r,"dum")},tek:{n:3,make:r=>vr(r,"tek")},ka:{n:3,make:r=>vr(r,"ka")},taiko:{n:3,make:r=>vr(r,"taiko")},boom:{n:2,make:r=>vr(r,"boom")},stepWalk:{n:6,make:r=>Fu(r,!1)},stepRun:{n:6,make:r=>Fu(r,!0)},skid:{n:3,make:ny},gravel:{n:3,make:iy},jar:{n:3,make:sy},rustle:{n:3,make:ry}};class ay{constructor(t){b(this,"sr");b(this,"musicIn");b(this,"musicDuck");b(this,"worldIn");b(this,"sfxWorld");b(this,"uiIn");b(this,"slowFilter");b(this,"slowVerb");b(this,"hallIn");b(this,"echoIn");b(this,"master");b(this,"mute");b(this,"out");b(this,"noise");b(this,"slowPitch",1);b(this,"garbage",[]);b(this,"banks",new Map);b(this,"warmQueue",["stepWalk","dum","tek","ka","taiko","stepRun","gravel","boom","jar","rustle","skid"]);b(this,"conv");b(this,"sum");b(this,"echoRet");b(this,"echoVerb");b(this,"echoLive",!1);b(this,"echoUntil",0);b(this,"ksCache",new Map);b(this,"ksQueue",[]);b(this,"curves",new Map);b(this,"waves",new Map);this.ctx=t,this.sr=t.sampleRate;for(let R=43;R<=84;R++)this.ksQueue.push(R*2);for(let R=57;R<=81;R++)this.ksQueue.push(R*2+1);const e=R=>{const E=t.createGain();return E.gain.value=R,E},n=(R,E,D=.707)=>{const M=t.createBiquadFilter();return M.type=R,M.frequency.value=this.hz(E),M.Q.value=D,M};this.noise={white:ac(t,"white",2.5,1),pink:ac(t,"pink",4,2),brown:ac(t,"brown",4,2)};const i=e(1),s=n("highpass",32,.7),o=t.createDynamicsCompressor();o.threshold.value=-12,o.knee.value=12,o.ratio.value=1.6,o.attack.value=.02,o.release.value=.3,this.master=e(.8),this.mute=e(1);const a=t.createDynamicsCompressor();a.threshold.value=-3,a.knee.value=1,a.ratio.value=20,a.attack.value=.002,a.release.value=.12;const c=e(.5),l=t.createWaveShaper();l.curve=this.curve("softclip",1),i.connect(s),s.connect(o),o.connect(this.master),this.master.connect(this.mute),this.mute.connect(a),a.connect(c),c.connect(l),l.connect(t.destination),this.out=l,this.musicIn=e(.68),this.musicDuck=e(1),this.musicIn.connect(this.musicDuck),this.musicDuck.connect(i),this.worldIn=e(1),this.slowFilter=n("lowpass",18e3,.7),this.worldIn.connect(this.slowFilter),this.slowFilter.connect(i),this.sfxWorld=e(1),this.sfxWorld.connect(this.worldIn),this.uiIn=e(1),this.uiIn.connect(i),this.hallIn=e(1);const h=n("highpass",180),d=t.createConvolver();this.conv=d;const f=n("lowpass",7e3),u=e(1.25);this.hallIn.connect(h),h.connect(d),d.connect(f),f.connect(u),u.connect(i),this.slowVerb=e(0),this.worldIn.connect(this.slowVerb),this.slowVerb.connect(this.hallIn),this.echoIn=e(1),this.echoIn.channelCount=1,this.echoIn.channelCountMode="explicit";const m=n("highpass",300),v=n("lowpass",2800),p=t.createDelay(2),g=t.createDelay(2);p.delayTime.value=.37,g.delayTime.value=.53;const x=n("lowpass",2200),_=n("lowpass",2e3),y=e(.33),w=e(.33);this.echoIn.connect(m),m.connect(v),v.connect(p),p.connect(x),x.connect(y),y.connect(g),g.connect(_),_.connect(w),w.connect(p);const T=t.createChannelMerger(2);p.connect(T,0,0),g.connect(T,0,1),this.echoRet=e(.5),this.echoVerb=e(.25),T.connect(this.echoRet),T.connect(this.echoVerb),this.sum=i}echoSend(){return this.echoLive||(this.echoRet.connect(this.sum),this.echoVerb.connect(this.hallIn),this.echoLive=!0),this.echoUntil=this.ctx.currentTime+10,this.echoIn}hz(t){return Re(t,5,this.sr*.45)}load(){return this.garbage.length}retire(t,e){this.garbage.push({t:e,nodes:t})}sweep(t){if(this.echoLive&&t>this.echoUntil&&(this.echoRet.disconnect(),this.echoVerb.disconnect(),this.echoLive=!1),!this.garbage.length)return;const e=[];for(const n of this.garbage)if(n.t<t)for(const i of n.nodes)try{i.disconnect()}catch{}else e.push(n);this.garbage=e}bank(t){let e=this.banks.get(t);return e||(e=[],this.banks.set(t,e)),e.length||e.push(lc[t].make(this.ctx)),e}warm(){if(!this.conv.buffer){this.conv.buffer=ey(this.ctx,3,.025);return}for(const e of this.warmQueue){let n=this.banks.get(e);if(n||(n=[],this.banks.set(e,n)),n.length<lc[e].n){n.push(lc[e].make(this.ctx));return}}const t=this.ksQueue.shift();t!==void 0&&this.ks(t>>1,t&1)}ks(t,e){const n=Math.round(Re(t,28,100)),i=n*2+(e?1:0);let s=this.ksCache.get(i);return s||(s=oy(this.ctx,n,e?.8:.3),this.ksCache.set(i,s)),s}curve(t,e){const n=t+e;let i=this.curves.get(n);if(!i){i=new Float32Array(2048);for(let o=0;o<2048;o++){const a=o/2047*2-1;if(t==="drive")i[o]=Math.tanh(e*a)/Math.tanh(e);else if(t==="pulse")i[o]=Math.pow((a+1)/2,e);else{const c=Math.abs(a*2);i[o]=Math.sign(a)*(c<=.8?c:.8+.18*Math.tanh((c-.8)/.18))}}this.curves.set(n,i)}return i}wave(t){let e=this.waves.get(t);if(!e){const i=new Float32Array(48),s=new Float32Array(48);for(let o=1;o<48;o++)t==="pulse"?i[o]=2*Math.sin(o*Math.PI*.22)/(o*Math.PI):s[o]=o===1?1:o===2?.3:o===3?.12:o===4?.05:0;e=this.ctx.createPeriodicWave(i,s),this.waves.set(t,e)}return e}dispose(){this.sweep(1/0)}}class hi{constructor(t){b(this,"nodes",[]);b(this,"starts",[]);b(this,"srcs",[]);this.c=t}reg(t){return this.nodes.push(t),t}src(t,e){this.srcs.push(t),this.starts.push(n=>t.start(Math.max(0,e??n)))}gain(t=1){const e=this.c.ctx.createGain();return e.gain.value=t,this.reg(e)}filter(t,e,n=.707,i=0){const s=this.c.ctx.createBiquadFilter();return s.type=t,s.frequency.value=this.c.hz(e),s.Q.value=n,i&&(s.gain.value=i),this.reg(s)}osc(t,e,n=0,i){const s=this.c.ctx.createOscillator();return s.type=t,s.frequency.value=e,s.detune.value=n,this.src(s,i),this.reg(s)}wave(t,e,n=0,i){const s=this.c.ctx.createOscillator();return s.setPeriodicWave(t),s.frequency.value=e,s.detune.value=n,this.src(s,i),this.reg(s)}constant(t,e){const n=this.c.ctx.createConstantSource();return n.offset.value=t,this.src(n,e),this.reg(n)}noise(t="white",e){const n=this.c.ctx.createBufferSource(),i=this.c.noise[t];n.buffer=i,n.loop=!0;const s=Math.random()*Math.max(0,i.duration-.5);return this.srcs.push(n),this.starts.push(o=>n.start(Math.max(0,e??o),s)),this.reg(n)}buffer(t,e=1,n){const i=this.c.ctx.createBufferSource();return i.buffer=t,i.playbackRate.value=e,this.src(i,n),this.reg(i)}pan(t){const e=this.c.ctx;if(typeof e.createStereoPanner=="function"){const n=e.createStereoPanner();return n.pan.value=Re(t,-1,1),this.reg(n)}return this.gain(1)}shaper(t){const e=this.c.ctx.createWaveShaper();return e.curve=t,this.reg(e)}merger(){return this.reg(this.c.ctx.createChannelMerger(2))}play(t,e){const n=Number.isFinite(e)?Math.max(t+.01,e):t+5;for(const i of this.starts)i(t);for(const i of this.srcs)i.stop(n);this.c.retire(this.nodes,n+.1)}}const cy={dum:.55,tek:1.6,ka:1.4,taiko:.55,boom:1};function Ji(r,t){r.connect(t.dry),t.wet&&r.connect(t.wet)}class ly{constructor(t){this.c=t}lyre(t,e,n,i,s=0,o=0){const a=this.c.ks(n,i>.6?1:0),c=new hi(this.c),l=a.rate*(1+et(-.0025,.0025)),h=c.buffer(a.buf,l),d=Re(i,0,1.5)*.8,f=c.gain(d),u=c.pan(s);h.connect(f),f.connect(u),Ji(u,t);let m=e+a.buf.duration/l;o>0&&e+o<m&&(f.gain.setValueAtTime(d,e+o),f.gain.setTargetAtTime(0,e+o,.06),m=e+o+.45),c.play(e,m)}strum(t,e,n,i,s=.032){n.forEach((o,a)=>this.lyre(t,e+a*s*et(.8,1.2),o,i*(1-a*.06),os(o)))}pad(t,e,n,i,s){if(!i.length)return;const o=new hi(this.c),a=s.voices??3,c=s.detune??9,l=o.gain(),h=o.gain();let d=0;for(const _ of i)for(let y=0;y<a;y++){const w=a===1?0:(y/(a-1)-.5)*2*c+et(-2,2);o.osc(s.type??"sawtooth",Ci(_),w,e+et(0,.03)).connect(d++%2===0?l:h)}l.gain.value=h.gain.value=2/Math.sqrt(d);const f=o.merger();l.connect(f,0,0),h.connect(f,0,1);const u=o.filter("lowpass",s.cutoff,s.q??.8);f.connect(u),u.frequency.setValueAtTime(this.c.hz(s.cutoff*.55),e),u.frequency.linearRampToValueAtTime(this.c.hz(s.cutoff),e+s.attack),s.cutoffEnd&&u.frequency.linearRampToValueAtTime(this.c.hz(s.cutoffEnd),e+n);const m=o.osc("sine",et(.06,.14),0,e),v=o.gain(s.lfoCents??250);m.connect(v),v.connect(u.detune);let p=u;if(s.trem){const _=o.gain(1-s.trem/2),y=o.osc("sine",s.tremRate??6,0,e),w=o.gain(s.trem/2);y.connect(w),w.connect(_.gain),u.connect(_),p=_}const g=o.gain(0);p.connect(g);const x=e+Math.max(s.attack,n-s.release);g.gain.setValueAtTime(0,e),g.gain.linearRampToValueAtTime(s.level,e+s.attack),g.gain.setValueAtTime(s.level,x),g.gain.setTargetAtTime(0,x,s.release/5),Ji(g,t),o.play(e,x+s.release*1.4)}choir(t,e,n,i,s){if(!i.length)return;const o=new hi(this.c),a=o.gain(),c=o.gain(),l=o.osc("sine",et(4.8,5.4),0,e),h=o.osc("sine",et(5.5,6.1),0,e),d=o.gain(0),f=o.gain(0);l.connect(d),h.connect(f);for(const M of[d,f])M.gain.setValueAtTime(0,e),M.gain.linearRampToValueAtTime(et(9,14),e+Math.min(1.4,s.attack+.5));let u=0;for(const M of i)for(let S=0;S<2;S++){const k=o.osc("sawtooth",Ci(M),(S?1:-1)*7+et(-3,3),e+et(0,.04));(u%2?f:d).connect(k.detune),k.connect(u%2?c:a),u++}a.gain.value=c.gain.value=1.2/Math.sqrt(u);const m=o.merger();a.connect(m,0,0),c.connect(m,0,1);const v=o.gain(1);m.connect(v);const p=s.breath??.12;if(p>0){const M=o.noise("white",e),S=o.filter("highpass",900,.5),k=o.gain(p);M.connect(S),S.connect(k),k.connect(v)}const g=zu[s.vowel],x=s.to?zu[s.to]:null,_=o.gain(1),y=[5,7,9],w=[1,.55,.28];for(let M=0;M<3;M++){const S=o.filter("bandpass",g[M],y[M]);x&&(S.frequency.setValueAtTime(g[M],e),S.frequency.linearRampToValueAtTime(x[M],e+(s.morph??s.attack)));const k=o.gain(w[M]*6);v.connect(S),S.connect(k),k.connect(_)}const T=o.filter("lowpass",480,.7),R=o.gain(.9);v.connect(T),T.connect(R),R.connect(_);const E=o.gain(0);_.connect(E);const D=e+Math.max(s.attack,n-s.release);E.gain.setValueAtTime(0,e),E.gain.linearRampToValueAtTime(s.level,e+s.attack),E.gain.setValueAtTime(s.level,D),E.gain.setTargetAtTime(0,D,s.release/5),Ji(E,t),o.play(e,D+s.release*1.4)}strStac(t,e,n,i,s=.2,o=1){const a=new hi(this.c),c=Ci(n),l=a.osc("sawtooth",c,-8,e),h=a.osc("sawtooth",c,8,e),d=c/2>=55,f=a.osc("sawtooth",d?c/2:c*2,d?0:5,e),u=a.gain(d?.45:.25);f.connect(u);const m=a.filter("lowpass",800,1.2);l.connect(m),h.connect(m),u.connect(m),m.frequency.setValueAtTime(this.c.hz(400+2600*i*o),e),m.frequency.setTargetAtTime(350+500*o,e+.01,s*.5);const v=a.gain(0);m.connect(v);const p=i*.22;v.gain.setValueAtTime(0,e),v.gain.linearRampToValueAtTime(p,e+.012),v.gain.setTargetAtTime(p*.5,e+.012,s*.4),v.gain.setTargetAtTime(0,e+s,.05);const g=a.pan(et(-.2,.2));v.connect(g),Ji(g,t),a.play(e,e+s+.4)}drum(t,e,n,i,s=0,o=1){const a=wn(this.c.bank(n)),c=new hi(this.c),l=o*et(.985,1.015),h=c.buffer(a,l),d=c.gain(i*cy[n]),f=c.pan(s);h.connect(d),d.connect(f),Ji(f,t),c.play(e,e+a.duration/l+.02)}shofar(t,e,n,i,s=220,o=293.66){const a=[];switch(n){case"tekiah":a.push({s:0,d:et(1.6,2),leap:!0});break;case"gedolah":a.push({s:0,d:et(3.6,4.2),leap:!0});break;case"shevarim":for(let L=0;L<3;L++)a.push({s:L*.62,d:.48,leap:!0});break;case"teruah":for(let L=0;L<9;L++)a.push({s:L*.15,d:L===8?.6:.1,leap:L===8});break}const c=new hi(this.c),l=c.constant(s,e),h=c.osc("sawtooth",0,0,e),d=c.osc("square",0,6,e);l.connect(h.frequency),l.connect(d.frequency);const f=c.osc("sine",et(4.5,6),0,e),u=c.gain(9),m=c.osc("sine",et(.4,.9),0,e),v=c.gain(12);f.connect(u),m.connect(v);for(const L of[h,d])u.connect(L.detune),v.connect(L.detune);const p=c.gain(.55),g=c.gain(.3);h.connect(p),d.connect(g);const x=c.shaper(this.c.curve("drive",2.5));p.connect(x),g.connect(x);const _=c.filter("lowpass",900,1.1);x.connect(_);const y=c.gain(1),w=[[520,3,1.6],[1350,5,1],[2700,6,.5]];for(const[L,V,O]of w){const P=c.filter("bandpass",L*et(.95,1.05),V),B=c.gain(O);_.connect(P),P.connect(B),B.connect(y)}const T=c.gain(.35);_.connect(T),T.connect(y);const R=c.noise("white",e),E=c.filter("bandpass",1500,.8),D=c.gain(.1);R.connect(E),E.connect(D),D.connect(y);const M=c.gain(0);y.connect(M),Ji(M,t);const S=l.offset,k=M.gain,N=_.frequency,z=i*.6;k.setValueAtTime(0,e),N.setValueAtTime(800,e);let H=e;return a.forEach((L,V)=>{const O=a[V+1],P=e+L.s,B=P+L.d,G=Math.min(L.d<.2?.035:.14,O?O.s-L.s-L.d-.01:1),Q=Math.min(.14,L.d*.4),ut=Math.min(.24,L.d*.6);if(S.setValueAtTime(s*.8,P),S.exponentialRampToValueAtTime(s*1.012,P+Q),S.exponentialRampToValueAtTime(s,P+ut),k.linearRampToValueAtTime(0,P),k.linearRampToValueAtTime(z*.7,P+Math.min(.05,L.d*.3)),k.linearRampToValueAtTime(z,P+ut),N.setValueAtTime(900,P),N.linearRampToValueAtTime(3200,P+ut),L.leap&&L.d>.3){const X=B-Math.min(.55,L.d*.4);S.setValueAtTime(s,X),S.exponentialRampToValueAtTime(o*1.012,X+.07),S.exponentialRampToValueAtTime(o,X+.18),S.exponentialRampToValueAtTime(o*.985,B),k.setValueAtTime(z,X),k.linearRampToValueAtTime(z*1.12,X+.1),k.linearRampToValueAtTime(z*1.02,B),N.setValueAtTime(3200,X),N.linearRampToValueAtTime(4200,X+.1)}else S.exponentialRampToValueAtTime(s*.99,B),k.linearRampToValueAtTime(z*.95,B);k.linearRampToValueAtTime(0,B+G),N.linearRampToValueAtTime(700,B+G),H=B+G}),c.play(e,H+.05),H}ney(t,e,n,i){const s=n.find(M=>M.midi>=0);if(!s)return e;const o=new hi(this.c),a=o.wave(this.c.wave("ney"),Ci(s.midi),0,e),c=o.osc("sine",et(4.6,5.4),0,e),l=o.gain(0);c.connect(l),l.connect(a.detune);const h=o.gain(0);a.connect(h);const d=o.noise("white",e),f=o.filter("bandpass",Ci(s.midi),5),u=o.filter("highpass",2500,.7),m=o.gain(.12),v=o.gain(0);d.connect(f),f.connect(v),d.connect(u),u.connect(m),m.connect(v);const p=o.gain(1);h.connect(p),v.connect(p);const g=o.filter("lowpass",4200,.6);p.connect(g);const x=o.pan(et(-.25,.25));g.connect(x),Ji(x,t);const _=h.gain,y=v.gain,w=l.gain,T=a.frequency,R=i*1.4;_.setValueAtTime(0,e),y.setValueAtTime(0,e),w.setValueAtTime(0,e);let E=e,D=-1;for(const M of n){const S=E+M.dur;if(M.midi<0){_.linearRampToValueAtTime(0,E+.06),y.linearRampToValueAtTime(0,E+.06),E=S,D=-1;continue}const k=Ci(M.midi),N=M.dur,z=Math.min(.07,N*.45),H=Math.min(.025,N*.2),L=Math.min(.12,N*.6),V=Math.max(E+z+.004,S-Math.min(.04,N*.25));D<0?(T.setValueAtTime(k*.96,E),T.exponentialRampToValueAtTime(k,E+z),_.setValueAtTime(0,E),y.setValueAtTime(0,E)):(T.setValueAtTime(Ci(D),E),T.exponentialRampToValueAtTime(k,E+Math.min(.045,N*.4))),f.frequency.setValueAtTime(this.c.hz(k),E),_.linearRampToValueAtTime(i,E+z),y.linearRampToValueAtTime(R*.9,E+H),y.linearRampToValueAtTime(R*.3,E+L),_.linearRampToValueAtTime(i*.85,V),_.linearRampToValueAtTime(i*.7,S),y.linearRampToValueAtTime(R*.3,S),w.setValueAtTime(0,E),M.dur>.35&&(w.linearRampToValueAtTime(0,E+Math.min(.25,M.dur*.4)),w.linearRampToValueAtTime(et(12,18),S)),D=M.midi,E=S}return _.linearRampToValueAtTime(0,E+.12),y.linearRampToValueAtTime(0,E+.1),o.play(e,E+.3),E}}function q0(r,t,e,n,i,s,o){const a=Q_(r,t,e);let c=Math.floor(a.length*et(.35,.65));const l=[];n.forEach((d,f)=>{const u=f===n.length-1;wn(u?o:s).forEach((v,p)=>{if(p>0&&!u&&je(.08)){l.push({midi:-1,dur:v*i});return}p===0?c=Uu(a,c,d):c=Re(c+wn([-2,-1,-1,1,1,2,0,-1]),0,a.length-1),l.push({midi:a[c],dur:v*i})})});const h=l[l.length-1];return h&&h.midi>=0&&(h.midi=a[Uu(a,a.indexOf(h.midi),[0,7])]),l}class Nr{constructor(t,e,n,i=.22){b(this,"out");b(this,"dryOut");b(this,"fader");b(this,"wetFader");b(this,"running",!1);b(this,"stopAt",1/0);b(this,"nextTime",0);b(this,"step",0);this.c=t,this.s=e,this.mix=n;const s=t.ctx,o=s.createGain(),a=s.createGain(),c=s.createGain();this.fader=s.createGain(),this.wetFader=s.createGain(),this.fader.gain.value=0,this.wetFader.gain.value=0,c.gain.value=i,a.gain.value=.6,o.connect(this.fader),this.fader.connect(t.musicIn),o.connect(c),c.connect(this.wetFader),a.connect(this.wetFader),this.wetFader.connect(t.hallIn),this.out={dry:o,wet:a},this.dryOut={dry:o,wet:null}}get barDur(){return this.stepDur*this.stepsPerBar}get active(){return this.running&&this.stopAt===1/0}activate(t,e){this.running||(this.running=!0,this.step=0,this.nextTime=t+.12,this.reset()),this.stopAt=1/0,gr(this.fader.gain,this.mix,t,e),gr(this.wetFader.gain,this.mix,t,e)}deactivate(t,e){this.running&&(gr(this.fader.gain,0,t,e),gr(this.wetFader.gain,0,t,e),this.stopAt=t+Math.max(.05,e))}dip(t,e,n,i){const s=this.fader.gain;gr(s,this.mix*e,t,.12),s.setTargetAtTime(this.mix,t+n,i/4)}schedule(t,e){if(!this.running)return;if(t>this.stopAt+.25){this.running=!1;return}if(this.nextTime<t-.05){const i=Math.ceil((t-this.nextTime)/this.stepDur);this.step+=i,this.nextTime+=i*this.stepDur}let n=0;for(;this.nextTime<e&&this.nextTime<this.stopAt&&n++<64;)this.onStep(this.step,this.nextTime),this.step++,this.nextTime+=this.stepDur}hum(t,e=.008){return Math.max(this.c.ctx.currentTime,t+et(-e,e))}}const hy=[0,4,3,2,1,2,0],uy=[2,2,1,1,1,1,4];class dy extends Nr{constructor(){super(...arguments);b(this,"stepDur",.5);b(this,"stepsPerBar",8);b(this,"prog",["Dm","Bb","Gm","A","Dm","Bb","C","Dm"]);b(this,"revealed",!1);b(this,"shofarDone",!1)}reset(){this.revealed=!1,this.shofarDone=!1}reveal(e){this.revealed=!0,this.shofarDone=!0,this.active&&(this.dip(e,.15,1.4,3),this.step=16*this.stepsPerBar,this.nextTime=e+1.6)}intensity(e){return this.revealed?1:Re(e/10,0,.85)}onStep(e,n){const i=this.s,s=Math.floor(e/8),o=e%8,a=this.intensity(s),c=Ks[this.prog[s%8]],l=h=>this.revealed||s>=h;o===0&&(s%2===0&&i.pad(this.out,n,this.barDur*2+3,a>.5?[38,45,50]:[38,45],{level:.12,attack:2.5,release:3,cutoff:350+500*a,voices:3,detune:7,lfoCents:300}),l(1)&&i.pad(this.out,n,this.barDur+1.5,gi(c,45,62),{level:.035+.05*a,attack:1.6-.8*a,release:2,cutoff:600+1200*a,voices:3,detune:10}),l(3)&&i.choir(this.out,n,this.barDur+2,gi(c,50,72),a<.5?{level:.03+.1*a,attack:2,release:2.5,vowel:"oo"}:{level:.03+.1*a,attack:2-a,release:2.5,vowel:"oh",to:"ah",morph:2.5}),i.drum(this.out,n,"taiko",.25+.35*a,0),!this.shofarDone&&s===4&&(i.shofar(this.out,n+.5,"tekiah",.26),this.shofarDone=!0),l(2)&&s%4===2&&this.motif(n,.55+.15*a)),l(4)&&o===4&&i.drum(this.out,n,"taiko",.18+.25*a,.1),l(6)&&((o===3||o===6)&&i.drum(this.dryOut,this.hum(n,.004),"dum",.2+.35*a,-.1),o%2===1&&je(.7)&&i.drum(this.dryOut,this.hum(n,.004),"tek",.08+.15*a,.15),s%8===7&&o>=4&&i.drum(this.dryOut,n+this.stepDur/2,"tek",.1+.05*(o-4),.2)),l(8)&&i.strStac(this.dryOut,this.hum(n,.003),la(c,38),(o%4===0?.45:.3)+.25*a,.35,.6)}motif(e,n){let i=0;hy.forEach((s,o)=>{const a=ty(Xl.aeolian,62,s);this.s.lyre(this.out,this.hum(e+i*this.stepDur),a,n*(o===0?1.1:1),os(a)),i+=uy[o]})}}const Bu=[[0,2,4,5,4,2],[0,3,2,4,3,5],[0,-1,2,3,-1,4],[1,2,3,2,4,3],[0,2,1,3,2,4],[0,4,3,-1,2,1]],hc=[["Dm","Dm","C","G","Dm","Am","G","Dm"],["Dm","F","C","G","Dm","C","Am","Dm"],["Dm","G","Dm","C","F","C","G","Dm"],["Dm","Am","G","Dm","F","G","C","Dm"]],fy=[[3,3],[2,1,3],[3,2,1],[1,1,1,3],[4,2],[2,2,2],[3,1,1,1]],py=[[6],[3,3],[4,2]];class my extends Nr{constructor(){super(...arguments);b(this,"stepDur",.34);b(this,"stepsPerBar",6);b(this,"prog",hc[0]);b(this,"pat",Bu[0]);b(this,"shift",0);b(this,"drums",!1);b(this,"light",!1);b(this,"fluteEnd",0)}reset(){this.prog=hc[0],this.fluteEnd=0,this.drums=!1,this.light=!1}onStep(e,n){const i=this.s,s=Math.floor(e/6),o=e%6,a=s%4,c=Math.floor(s/4);o===0&&s%8===0&&s>0&&(this.prog=wn(hc));const l=Ks[this.prog[s%8]];if(o===0){if(a===0&&(i.pad(this.out,n,this.barDur*4+3.5,[38,45,50],{level:.1,attack:3,release:3.5,cutoff:480,voices:3,detune:6,lfoCents:300}),this.drums=c>0&&je(.45),this.light=c>0&&je(.25),c>0&&n>this.fluteEnd&&je(.55))){const u=[0,1,2,3].map(v=>Ks[this.prog[(s+v)%8]]),m=q0(Xl.dorian,62,81,u,this.stepDur,fy,py);this.fluteEnd=i.ney(this.out,n,m,.17)}i.pad(this.out,n,this.barDur+1.6,gi(l,52,67).slice(0,4),{level:.055,attack:1,release:1.6,cutoff:1400,voices:2,detune:11}),this.pat=wn(Bu),this.shift=Qn(0,2),i.lyre(this.out,this.hum(n),la(l,43),.38,-.3)}const h=gi(l,57,81),d=this.pat[o],f=n<this.fluteEnd;if(d>=0&&(!this.light||o===0||o===3)&&je(f?.7:.92)){const u=h[Math.min(h.length-1,d+this.shift)],m=(o===0?.72:o===3?.6:.46)*et(.85,1.1)*(f?.8:1);o===0&&je(.2)?i.strum(this.out,this.hum(n),h.slice(this.shift,this.shift+3),m):i.lyre(this.out,this.hum(n),u,m,os(u))}this.drums&&(o===0?i.drum(this.dryOut,this.hum(n,.004),"dum",.3,-.1):o===3?i.drum(this.dryOut,this.hum(n,.004),"tek",.14,.15):o===5&&je(.5)&&i.drum(this.dryOut,this.hum(n,.004),"ka",.1,.2))}}const gy=[[0,1,4,1],[7,8,7,4],[4,5,7,5],[12,10,8,7],[1,0,-2,0],[7,4,1,0]];class vy extends Nr{constructor(){super(...arguments);b(this,"stepDur",.36);b(this,"stepsPerBar",8);b(this,"motif",null);b(this,"base",50)}reset(){this.motif=null}onStep(e,n){const i=this.s,s=Math.floor(e/8),o=e%8,a=s%4,c=Math.floor(s/4);if(o===0&&a===0&&(i.pad(this.out,n,this.barDur*4+3,[38,45,50],{level:.1,attack:2.5,release:3,cutoff:380,voices:3,detune:8,lfoCents:400}),i.pad(this.out,n+this.barDur,this.barDur*3+2,c%2===0?[74,75]:[69,70],{level:.022,attack:4,release:2.5,cutoff:2600,voices:2,detune:6,trem:.5,tremRate:6.5}),c%3===2&&i.choir(this.out,n,this.barDur*4,[50,57,63],{level:.04,attack:3,release:3,vowel:"oo"})),o===0&&i.drum(this.out,this.hum(n,.003),"taiko",.42,0),o===1&&i.drum(this.out,this.hum(n,.003),"taiko",.26,0),o===4&&je(.6)&&i.drum(this.dryOut,this.hum(n),"dum",.26,-.15),a===3&&o>=5&&i.drum(this.dryOut,this.hum(n),"tek",.1+(o-5)*.07,.2),o%2===0&&i.strStac(this.dryOut,this.hum(n),a===2&&o>=4?39:38,o===0?.5:.36,.3,.4),o===0&&s%2===1&&je(.6)&&(this.motif=wn(gy),this.base=wn([50,62])),this.motif&&o%2===0){const l=o/2;if(l<this.motif.length){const h=this.base+this.motif[l];i.lyre(this.out,this.hum(n),h,et(.38,.5),os(h))}}o===7&&(this.motif=null)}}const uc=[["D","Eb","D","Cm","D","Bb","Cm","D"],["D","Gm","D","Eb","Bb","Cm","Eb","D"]],dc=["B.Tk.kT.Dk.kT.k.","B.Dk.kT.Dk.kT.kk","B.Tk.TkkD.TkT.Tk"],xy="B.Tk.kT.TkTkTTTT",_y=[0,0,12,0,0,12,7,12];class yy extends Nr{constructor(){super(...arguments);b(this,"stepDur",60/118/4);b(this,"stepsPerBar",16);b(this,"sec",uc[0]);b(this,"pat",dc[0]);b(this,"full",!0);b(this,"alt",!1)}reset(){this.sec=uc[0],this.pat=dc[0],this.full=!0,this.alt=!1}onStep(e,n){const i=this.s,s=Math.floor(e/16),o=e%16,a=s%8,c=Math.floor(s/8);o===0&&a===0&&(c>0&&(this.sec=wn(uc),this.full=c%2===0||je(.5)),i.drum(this.out,n,"boom",.3,0),(c===0||je(.75))&&(i.shofar(this.out,n+.05,this.alt?"teruah":"tekiah",.24),this.alt=!this.alt)),o===0&&s%2===0&&(this.pat=wn(dc));const l=Ks[this.sec[a]],h=la(l,33),d=s%4===3,f=o%4===0?1:.8,u=d&&o>=8?.6+(o-8)*.06:1;switch((d?xy:this.pat)[o]){case"B":i.drum(this.out,n,"taiko",.5,0),i.drum(this.dryOut,n,"dum",.55,-.1);break;case"D":i.drum(this.dryOut,this.hum(n,.004),"dum",.62*f,-.1);break;case"T":i.drum(this.dryOut,this.hum(n,.004),"tek",.55*f*u,.15);break;case"k":je(.8)&&i.drum(this.dryOut,this.hum(n,.004),"ka",et(.2,.32),.25);break}if(o===8&&s%2===1&&i.drum(this.out,n,"taiko",.36,.1),d&&o===14&&i.drum(this.out,n,"taiko",.5,-.1),o%2===0){const m=o/2;i.strStac(this.dryOut,this.hum(n,.003),h+_y[m],m%4===0?.85:.62,.17,1)}if(o===0&&i.pad(this.out,n,this.barDur+.4,[h+12,h+19,h+24],{level:.04,attack:.12,release:.4,cutoff:1100,voices:2,detune:12}),this.full&&o===0&&a%2===0&&i.choir(this.out,n,1.1,gi(l,55,72),{level:.13,attack:.04,release:.6,vowel:"ah"}),this.full&&a===7&&o===8&&i.choir(this.out,n,.9,gi(l,57,74),{level:.12,attack:.03,release:.5,vowel:"ah"}),this.full&&a>=4&&o%2===1){const m=gi(l,62,81),v=m[(o>>1)%m.length];i.lyre(this.dryOut,this.hum(n,.003),v,.3,os(v),.25)}}}const fc=[["D","G","C","D"],["Bm","G","A","D"],["D","C","G","D"],["G","D","A","D"]],My=[[4,4],[2,2,4],[3,1,4],[2,2,2,2],[6,2],[4,2,2]],by=[[8],[4,4],[6,2]];class Sy extends Nr{constructor(){super(...arguments);b(this,"stepDur",60/66/2);b(this,"stepsPerBar",8);b(this,"prog",fc[0]);b(this,"fluteEnd",0)}reset(){this.prog=fc[0],this.fluteEnd=0}onStep(e,n){const i=this.s,s=Math.floor(e/8),o=e%8,a=s%4,c=Math.floor(s/4);o===0&&a===0&&c>0&&(this.prog=wn(fc));const l=Ks[this.prog[a]];if(o===0){s===0?i.shofar(this.out,n+.6,"gedolah",.28,220,293.66):a===0&&c%4===0&&i.shofar(this.out,n+.3,"tekiah",.22,220,293.66),i.choir(this.out,n,this.barDur+1.2,gi(l,50,71),{level:.1,attack:1.3,release:1.8,vowel:"oh",to:"ah",morph:1.5});const u=la(l,38);if(i.pad(this.out,n,this.barDur+1.5,[u,u+7,u+12],{level:.07,attack:.5,release:1.6,cutoff:900,voices:3}),i.drum(this.out,n,"taiko",.36,0),a===0&&c>0&&n>this.fluteEnd&&je(.5)){const m=[0,1,2,3].map(v=>Ks[this.prog[v]]);this.fluteEnd=i.ney(this.out,n,q0(Xl.mixolydian,62,81,m,this.stepDur,My,by),.16)}}o===4&&i.drum(this.dryOut,this.hum(n),"dum",.3,-.1),(o===2||o===6)&&i.drum(this.dryOut,this.hum(n),"tek",.12,.15);const h=gi(l,57,84),d=[0,1,2,3,4,3,2,1][o]+s%2,f=n<this.fluteEnd?.75:1;if(o===0&&je(.5))i.strum(this.out,this.hum(n),h.slice(0,4),.7*f);else{const u=h[Math.min(h.length-1,d)];i.lyre(this.out,this.hum(n),u,(o===0?.7:.5*et(.9,1.1))*f,os(u))}}}const wy=.3,Ty=.55,Ey=1.1;class Ay{constructor(t){b(this,"nodes",[]);b(this,"srcs",[]);b(this,"windBus");b(this,"cicBus");b(this,"birdBus");b(this,"wLP");b(this,"wLow");b(this,"wBP");b(this,"wHigh");b(this,"wWh");b(this,"wWhG");b(this,"cicadas",[]);b(this,"bus");b(this,"level",{wind:-1,cicadas:-1,birds:-1});b(this,"live",{wind:!1,cicadas:!1});b(this,"silentSince",{wind:0,cicadas:0});b(this,"phase",Math.random()*100);b(this,"last",0);b(this,"nextUpd",0);b(this,"nextBird",0);b(this,"n1",new oc);b(this,"n2",new oc);b(this,"n3",new oc);this.c=t;const e=t.ctx,n=e.currentTime,i=x=>(this.nodes.push(x),x),s=x=>{const _=i(e.createGain());return _.gain.value=x,_},o=(x,_,y)=>{const w=i(e.createBiquadFilter());return w.type=x,w.frequency.value=t.hz(_),w.Q.value=y,w},a=x=>{const _=i(e.createBufferSource());return _.buffer=x,_.loop=!0,_.start(n,Math.random()*Math.max(0,x.duration-.5)),this.srcs.push(_),_},c=x=>{const _=i(e.createOscillator());return _.frequency.value=x,_.start(n),this.srcs.push(_),_},l=x=>{if(typeof e.createStereoPanner=="function"){const _=i(e.createStereoPanner());return _.pan.value=x,_}return s(1)},h=s(1);h.connect(t.worldIn);const d=s(.12);h.connect(d),d.connect(t.hallIn),this.windBus=s(0),this.cicBus=s(0),this.birdBus=s(0),this.bus=h,this.birdBus.connect(h);const f=s(.25);this.birdBus.connect(f),f.connect(t.hallIn);const u=a(t.noise.brown),m=a(t.noise.pink);this.wLP=o("lowpass",400,.5),this.wLow=s(.5),u.connect(this.wLP),this.wLP.connect(this.wLow),this.wLow.connect(this.windBus),this.wBP=o("bandpass",1e3,.6),this.wHigh=s(.1),m.connect(this.wBP),this.wBP.connect(this.wHigh),this.wHigh.connect(this.windBus),this.wWh=o("bandpass",800,14),this.wWhG=s(0),m.connect(this.wWh),this.wWh.connect(this.wWhG),this.wWhG.connect(this.windBus);const v=a(t.noise.white),p=a(t.noise.white);[{f:4800,q:5,buzz:110,pr:0,pd:0,pan:-.6,amp:1,sing:[8,20],rest:[1,3]},{f:6200,q:7,buzz:140,pr:7,pd:.8,pan:.55,amp:.8,sing:[3,9],rest:[2,6]},{f:5400,q:4,buzz:95,pr:2.6,pd:.55,pan:.1,amp:.55,sing:[4,10],rest:[3,8]}].forEach((x,_)=>{const y=o("bandpass",x.f*et(.95,1.05),x.q);(_===1?p:v).connect(y);const w=s(0),T=i(e.createWaveShaper());T.curve=t.curve("pulse",2.5),c(x.buzz*et(.95,1.05)).connect(T),T.connect(w.gain),y.connect(w);let R=w;if(x.pr>0){const M=s(1-x.pd),S=s(x.pd),k=i(e.createWaveShaper());k.curve=t.curve("pulse",1.5),c(x.pr*et(.9,1.1)).connect(k),k.connect(S),S.connect(M.gain),w.connect(M),R=M}const E=s(0);R.connect(E);const D=l(x.pan);E.connect(D),D.connect(this.cicBus),this.cicadas.push({phrase:E,singing:!1,until:n+et(0,2),amp:x.amp,sing:x.sing,rest:x.rest})})}setLevels(t,e){t.wind>0&&!this.live.wind&&(this.windBus.connect(this.bus),this.live.wind=!0),t.cicadas>0&&!this.live.cicadas&&(this.cicBus.connect(this.bus),this.live.cicadas=!0),t.wind<=0&&this.level.wind!==0&&(this.silentSince.wind=e),t.cicadas<=0&&this.level.cicadas!==0&&(this.silentSince.cicadas=e),t.wind!==this.level.wind&&this.windBus.gain.setTargetAtTime(t.wind*wy,e,.8),t.cicadas!==this.level.cicadas&&this.cicBus.gain.setTargetAtTime(t.cicadas*Ty,e,.8),t.birds!==this.level.birds&&this.birdBus.gain.setTargetAtTime(t.birds*Ey,e,.5),this.level.birds<=.02&&t.birds>.02&&(this.nextBird=e+et(.5,2)),this.level.wind=t.wind,this.level.cicadas=t.cicadas,this.level.birds=t.birds}tick(t,e){const n=Re(t-this.last,0,.5);if(this.last=t,this.phase+=n*Xn(1,.35,e),this.live.wind&&this.level.wind<=0&&t-this.silentSince.wind>5&&(this.windBus.disconnect(),this.live.wind=!1),this.live.cicadas&&this.level.cicadas<=0&&t-this.silentSince.cicadas>5&&(this.cicBus.disconnect(),this.live.cicadas=!1),t>=this.nextUpd){this.nextUpd=t+.1;const i=this.phase;if(this.level.wind>0){const s=Re(.55*this.n1.at(i*.09)+.35*this.n2.at(i*.31)+.1*this.n3.at(i*1.3),0,1),o=s*s;this.wLow.gain.setTargetAtTime(.35+.65*s,t,.25),this.wLP.frequency.setTargetAtTime(220+650*s,t,.25),this.wHigh.gain.setTargetAtTime(.04+.35*o,t,.25),this.wBP.frequency.setTargetAtTime(600+1600*s,t,.25),this.wWh.frequency.setTargetAtTime(450+900*this.n3.at(i*.2),t,.4),this.wWhG.gain.setTargetAtTime(1.2*o*s,t,.25)}if(this.level.cicadas>0)for(const s of this.cicadas)t<s.until||(s.singing=!s.singing,s.until=t+(s.singing?et(s.sing[0],s.sing[1]):et(s.rest[0],s.rest[1])),s.phrase.gain.setTargetAtTime(s.singing?s.amp*et(.7,1):0,t,s.singing?.7:1))}this.level.birds>.02&&t>=this.nextBird&&(this.bird(t+.05),this.nextBird=t+Xn(12,2,this.level.birds)*et(.5,1.5)/Xn(1,.5,e))}bird(t){const e=this.c,n=new hi(e),i=Math.random(),s=i<.35?"chirp":i<.6?"warble":i<.75?"trill":i<.9?"dove":"hoopoe",o=et(.3,1),a=n.osc("sine",3e3,0,t),c=n.osc("sine",30,0,t),l=n.gain(0);c.connect(l),l.connect(a.frequency);const h=n.gain(0),d=n.filter("lowpass",Xn(3500,12e3,o),.7),f=n.pan(et(-.85,.85));a.connect(h),h.connect(d),d.connect(f),f.connect(this.birdBus);const u=a.frequency,m=h.gain;let v=t;switch(m.setValueAtTime(0,t),s){case"chirp":{const p=Qn(2,6),g=et(2800,4300),x=je(.5),_=.1*o;for(let y=0;y<p;y++){const w=et(.04,.08);u.setValueAtTime(g*(x?.8:1.25),v),u.exponentialRampToValueAtTime(g*(x?1.25:.8),v+w),m.setValueAtTime(0,v),m.linearRampToValueAtTime(_,v+.008),m.linearRampToValueAtTime(0,v+w),v+=w+et(.06,.16)}break}case"trill":{const p=et(.4,.9),g=et(3500,5e3),x=.07*o;c.frequency.value=et(22,38),l.gain.setValueAtTime(et(300,700),t),u.setValueAtTime(g,t),u.linearRampToValueAtTime(g*.85,t+p),m.linearRampToValueAtTime(x,t+.03),m.setValueAtTime(x,t+p-.05),m.linearRampToValueAtTime(0,t+p),v=t+p;break}case"warble":{const p=Qn(5,9),g=.08*o;let x=et(2200,3500);u.setValueAtTime(x,t),m.linearRampToValueAtTime(g,t+.02);for(let _=0;_<p;_++){const y=et(.05,.12),w=Re(x*et(.75,1.3),1800,4800);u.exponentialRampToValueAtTime(w,v+y*.6),m.linearRampToValueAtTime(g*et(.6,1),v+y*.5),m.linearRampToValueAtTime(g*.25,v+y),x=w,v+=y}m.linearRampToValueAtTime(0,v+.03);break}case"dove":{const p=et(480,600),g=.12*o,x=[.22,.32,.2,.2,.26].slice(0,Qn(3,5));c.frequency.value=et(18,26),l.gain.value=6;for(const _ of x)u.setValueAtTime(p*.94,v),u.linearRampToValueAtTime(p,v+_*.4),u.linearRampToValueAtTime(p*.92,v+_),m.setValueAtTime(0,v),m.linearRampToValueAtTime(g,v+.05),m.linearRampToValueAtTime(g*.8,v+_-.05),m.linearRampToValueAtTime(0,v+_),v+=_+et(.08,.14);break}case"hoopoe":{const p=et(380,440),g=.13*o;for(let x=0;x<3;x++)u.setValueAtTime(p*1.05,v),u.exponentialRampToValueAtTime(p*.95,v+.12),m.setValueAtTime(0,v),m.linearRampToValueAtTime(g,v+.025),m.linearRampToValueAtTime(0,v+.12),v+=.3;break}}n.play(t,v+.1)}dispose(){for(const t of this.srcs)try{t.stop()}catch{}for(const t of this.nodes)try{t.disconnect()}catch{}}}const Ry=.55;class Cy{constructor(t){b(this,"nodes",[]);b(this,"srcs",[]);b(this,"lfo",null);b(this,"bp",null);b(this,"fmD",null);b(this,"level",null);b(this,"active",!1);b(this,"lastActive",-10);b(this,"lastSet",-10);b(this,"lastPower",-1);this.c=t}build(t){const e=this.c.ctx,n=g=>(this.nodes.push(g),g),i=g=>{const x=n(e.createGain());return x.gain.value=g,x},s=n(e.createBufferSource());s.buffer=this.c.noise.pink,s.loop=!0;const o=n(e.createBufferSource());o.buffer=this.c.noise.brown,o.loop=!0;const a=n(e.createOscillator());a.frequency.value=2;const c=n(e.createBiquadFilter());c.type="bandpass",c.frequency.value=600,c.Q.value=1.6;const l=n(e.createBiquadFilter());l.type="lowpass",l.frequency.value=260,l.Q.value=.8;const h=n(e.createWaveShaper());h.curve=this.c.curve("pulse",3);const d=i(.06),f=i(1.6),u=i(0),m=i(.7),v=i(300),p=i(0);if(s.connect(c),c.connect(d),d.connect(p),o.connect(l),l.connect(u),u.connect(p),a.connect(h),h.connect(f),f.connect(d.gain),h.connect(m),m.connect(u.gain),a.connect(v),v.connect(c.frequency),typeof e.createStereoPanner=="function"){const g=n(e.createStereoPanner()),x=i(.35);a.connect(x),x.connect(g.pan),p.connect(g),g.connect(this.c.sfxWorld)}else p.connect(this.c.sfxWorld);s.start(t,Math.random()*4),o.start(t,Math.random()*4),a.start(t),this.srcs=[s,o,a],this.lfo=a,this.bp=c,this.fmD=v,this.level=p}set(t,e,n){const i=Re(Rn(e,0),0,1);if(t&&(this.lastActive=n,this.lfo||this.build(n)),!this.lfo||!this.bp||!this.fmD||!this.level||t===this.active&&Math.abs(i-this.lastPower)<.01&&n-this.lastSet<.2)return;this.active=t,this.lastPower=i,this.lastSet=n;const s=this.c.slowPitch;t?(this.lfo.frequency.setTargetAtTime((2+5*i)*s,n,.06),this.bp.frequency.setTargetAtTime(this.c.hz((420+1100*i)*s),n,.08),this.fmD.gain.setTargetAtTime((200+500*i)*s,n,.08),this.level.gain.setTargetAtTime(Ry*(.35+.65*i),n,.06)):this.level.gain.setTargetAtTime(0,n,.035)}tick(t){this.lfo&&(this.active&&t-this.lastActive>.3?this.set(!1,0,t):!this.active&&t-this.lastActive>2.5&&this.teardown())}teardown(){for(const t of this.srcs)try{t.stop()}catch{}for(const t of this.nodes)try{t.disconnect()}catch{}this.nodes=[],this.srcs=[],this.lfo=null,this.bp=null,this.fmD=null,this.level=null,this.active=!1}}const Py=new Set(["uiObjective","uiConfirm","heartbeat","titleHit","shepherdCall","shepherdWhistle"]),Ly={footstep:["step",4],footstepRun:["step",4],sheepBleat:["bleat",4],lambBleat:["bleat",4],goatBleat:["bleat",4],bearRoar:["bear",2],bearGrowl:["bear",2],bearHurt:["bearHurt",2],bearDeath:["bearDeath",1],stoneHit:["stone",6],jarShatter:["jar",4],heartbeat:["heart",2],titleHit:["title",1],impactBoom:["boom",2],shepherdCall:["call",2],shepherdWhistle:["call",2]},ky={footstep:1.3,stoneHitBear:.75,jarShatter:.7,sheepBleat:.6,lambBleat:.6,goatBleat:.42,bearRoar:.7,bearGrowl:.85,bearHurt:.6,bearDeath:.7,davidHurt:.6,heartbeat:.7,impactBoom:.65,titleHit:.6},Dy={sheep:{f:[165,230],dur:[.55,.95],vib:[6,8],fm:.03,am:.6,breath:.1,formants:[[780,5,1],[1250,7,.6],[2600,9,.28]],pulse:!1,level:1},lamb:{f:[330,460],dur:[.3,.55],vib:[8,10.5],fm:.035,am:.5,breath:.08,formants:[[980,5,1],[1750,7,.6],[3100,9,.3]],pulse:!1,level:.9},goat:{f:[250,330],dur:[.55,1.05],vib:[10,14],fm:.025,am:.85,breath:.12,formants:[[560,6,.9],[1900,9,.8],[2800,10,.35]],pulse:!0,level:1}},Iy={roar:{dur:[1.7,2.4],f0:[[0,50],[.12,78],[.35,98],[.7,84],[1,48]],F1:[[0,300],[.1,560],[.5,650],[.85,520],[1,320]],amp:[[0,0],[.08,.8],[.25,1],[.7,.9],[.9,.5],[1,0]],noise:[[0,.5],[1,.6]],rasp:[34,24],raspDepth:.55,drive:4,wet:.35,echo:.22,level:.9},growl:{dur:[.8,1.3],f0:[[0,42],[.3,56],[.7,52],[1,40]],F1:[[0,250],[.3,380],[1,280]],amp:[[0,0],[.15,.9],[.6,1],[1,0]],noise:[[0,.45],[1,.45]],rasp:[24,18],raspDepth:.75,drive:3,wet:.2,echo:.06,level:.8},hurt:{dur:[.4,.6],f0:[[0,120],[.15,190],[.5,170],[1,90]],F1:[[0,450],[.15,780],[1,380]],amp:[[0,0],[.06,1],[.5,.8],[1,0]],noise:[[0,.5],[1,.5]],rasp:[42,30],raspDepth:.4,drive:5,wet:.3,echo:.15,level:.85},death:{dur:[2.8,3.6],f0:[[0,90],[.15,84],[.5,62],[.8,42],[1,30]],F1:[[0,520],[.3,480],[.7,320],[1,230]],amp:[[0,0],[.08,.9],[.4,.75],[.75,.45],[1,0]],noise:[[0,.4],[.6,.5],[1,.9]],rasp:[30,11],raspDepth:.7,drive:3.5,wet:.4,echo:.2,level:.9}};class Ny{constructor(t,e){b(this,"onTitleHit",null);b(this,"active",new Map);b(this,"table");this.c=t,this.syn=e,this.table={footstep:(n,i,s,o)=>this.sample(n,s,i,"stepWalk",o*et(.9,1.1),et(.4,.55)),footstepRun:(n,i,s,o)=>this.sample(n,s,i,"stepRun",o*et(.92,1.1),et(.55,.7)),slingRelease:(n,i,s,o,a)=>this.slingRelease(n,i,s,o,a),stoneHit:(n,i,s,o,a)=>this.stoneHit(n,i,s,o,a),stoneHitBear:(n,i,s,o,a)=>this.stoneHitBear(n,i,s,o,a),jarShatter:(n,i,s,o,a)=>{const c=this.sample(n,s,i,"jar",o*et(.93,1.07),.9);return this.thump(n,s,i,200*o,120*o,.25,.04,.05),a.hall(.15),c},sheepBleat:(n,i,s,o,a)=>this.bleat(n,i,s,o,"sheep",a),lambBleat:(n,i,s,o,a)=>this.bleat(n,i,s,o,"lamb",a),goatBleat:(n,i,s,o,a)=>this.bleat(n,i,s,o,"goat",a),bearRoar:(n,i,s,o,a)=>this.beast(n,i,s,o,"roar",a),bearGrowl:(n,i,s,o,a)=>this.beast(n,i,s,o,"growl",a),bearHurt:(n,i,s,o,a)=>this.beast(n,i,s,o,"hurt",a),bearDeath:(n,i,s,o,a)=>this.beast(n,i,s,o,"death",a),staffHit:(n,i,s,o,a)=>this.staffHit(n,i,s,o,a),whoosh:(n,i,s,o)=>this.swoosh(n,s,i,o,.34,320,1500,420,1.4),grab:(n,i,s,o)=>{const a=this.sample(n,s,i,"rustle",o*et(.9,1.1),.55);return this.thump(n,s,i,95*o,60*o,.3,.06,.06),Math.max(a,this.human(n,i+.04,s,o,"effort",.45))},davidHurt:(n,i,s,o)=>this.human(n,i,s,o,"hurt",.9),davidEffort:(n,i,s,o)=>this.human(n,i,s,o,"effort",.8),pickup:(n,i,s,o)=>this.pickup(n,i,s,o),uiObjective:(n,i,s,o,a)=>{const c=Math.round(12*Math.log2(o));return[69,74,81].forEach((l,h)=>this.syn.lyre({dry:s,wet:null},i+h*.13,l+c,.55+h*.05,(h-1)*.25)),a.hall(.35),i+3},uiConfirm:(n,i,s,o,a)=>(this.syn.lyre({dry:s,wet:null},i,74+Math.round(12*Math.log2(o)),.65,0),a.hall(.25),i+2.4),heartbeat:(n,i,s,o)=>(this.thump(n,s,i,62*o,40*o,.95,.07,.09,"triangle"),this.thump(n,s,i+.17,55*o,38*o,.62,.08,.1,"triangle"),this.burst(n,s,i,"brown","lowpass",180,.7,.5,.004,.05),i+.8),impactBoom:(n,i,s,o,a)=>{const c=this.sample(n,s,i,"boom",o*et(.95,1.05),1);return this.thump(n,s,i,70*o,30*o,.6,.5,.5),this.burst(n,s,i,"white","lowpass",3500,.7,.35,.001,.025),a.hall(.5),a.echo(.12),Math.max(c,i+3.5)},dodge:(n,i,s,o)=>Math.max(this.swoosh(n,s,i,o,.22,500,2200,700,1.1),this.sample(n,s,i+.05,"skid",o*et(.9,1.1),.5)),titleHit:(n,i,s,o,a)=>this.titleHit(n,i,s,a),shepherdCall:(n,i,s,o,a)=>this.shepherdCall(i,s,o,a),shepherdWhistle:(n,i,s,o,a)=>this.shepherdWhistle(n,i,s,o,a)}}play(t,e,n){const i=this.table[t];if(typeof i!="function")return;const s=this.c,o=Py.has(t),[a,c]=Ly[t]??[t,4],l=(this.active.get(a)??[]).filter(_=>_>n);if(this.active.set(a,l),l.length>=c||!o&&s.load()>260)return;const h=e??{},d=Re(Rn(h.volume,1),0,2);if(d<.001)return;const f=Re(Rn(h.pitch,1),.25,4)*(o?1:s.slowPitch),u=new hi(s),m=u.gain(d*(ky[t]??1)),v=u.pan(Re(Rn(h.pan,0),-1,1));m.connect(v),v.connect(o?s.uiIn:s.sfxWorld);const p={hall:_=>{if(_>0){const y=u.gain(_);v.connect(y),y.connect(s.hallIn)}},echo:_=>{if(_>0){const y=u.gain(_);v.connect(y),y.connect(s.echoSend())}}},g=n+.012,x=i(u,g,m,f,p);u.play(g,Math.max(x,g+.05)),l.push(x)}sample(t,e,n,i,s,o){const a=wn(this.c.bank(i)),c=t.buffer(a,s,n),l=t.gain(o);return c.connect(l),l.connect(e),n+a.duration/s}ping(t,e,n,i,s,o){const a=t.osc("sine",this.c.hz(i),0,n),c=t.gain(0);Eo(c.gain,n,8e-4,s,o),a.connect(c),c.connect(e)}burst(t,e,n,i,s,o,a,c,l,h){const d=t.noise(i,n),f=t.filter(s,o,a),u=t.gain(0);Eo(u.gain,n,l,c,h),d.connect(f),f.connect(u),u.connect(e)}thump(t,e,n,i,s,o,a,c,l="sine"){const h=t.osc(l,i,0,n);h.frequency.setValueAtTime(i,n),h.frequency.exponentialRampToValueAtTime(Math.max(1,s),n+c);const d=t.gain(0);Eo(d.gain,n,.002,o,a),h.connect(d),d.connect(e)}swoosh(t,e,n,i,s,o,a,c,l){const h=this.c,d=s/Math.sqrt(i),f=t.noise("pink",n),u=t.filter("bandpass",o*i,1.3),m=t.gain(0);u.frequency.setValueAtTime(h.hz(o*i),n),u.frequency.exponentialRampToValueAtTime(h.hz(a*i),n+d*.45),u.frequency.exponentialRampToValueAtTime(h.hz(c*i),n+d),m.gain.setValueAtTime(0,n),m.gain.linearRampToValueAtTime(l,n+d*.45),m.gain.linearRampToValueAtTime(0,n+d),f.connect(u),u.connect(m),m.connect(e);const v=t.noise("white",n),p=t.filter("highpass",3500,.7),g=t.gain(0);return g.gain.setValueAtTime(0,n),g.gain.linearRampToValueAtTime(l*.12,n+d*.45),g.gain.linearRampToValueAtTime(0,n+d),v.connect(p),p.connect(g),g.connect(e),n+d+.05}slingRelease(t,e,n,i,s){const o=this.c;this.burst(t,n,e,"white","highpass",2e3*i,.7,.35,.001,.01);const a=t.noise("pink",e),c=t.filter("bandpass",700*i,2.2),l=t.gain(0);c.frequency.setValueAtTime(o.hz(700*i),e),c.frequency.exponentialRampToValueAtTime(o.hz(3200*i),e+.09),Eo(l.gain,e,.006,.8,.05),a.connect(c),c.connect(l),l.connect(n);const h=e+.02,d=t.noise("pink",h),f=t.filter("bandpass",2200*i,3.5),u=t.gain(0);return f.frequency.setValueAtTime(o.hz(2200*i),h),f.frequency.exponentialRampToValueAtTime(o.hz(650*i),e+.5),u.gain.setValueAtTime(0,h),u.gain.linearRampToValueAtTime(.7,e+.07),u.gain.setTargetAtTime(0,e+.07,.11),d.connect(f),f.connect(u),u.connect(n),this.thump(t,n,e,190*i,80*i,.22,.025,.05),s.echo(.18),s.hall(.12),e+.9}stoneHit(t,e,n,i,s){const o=et(1700,2600)*i;this.ping(t,n,e,o,.24,.02),this.ping(t,n,e,o*1.63,.15,.013),this.ping(t,n,e,o*2.4,.07,.008),this.burst(t,n,e,"white","highpass",2500,.7,.35,5e-4,.004),this.thump(t,n,e,120*i,55*i,.35,.045,.07);const a=this.sample(t,n,e+.012,"gravel",i*et(.9,1.2),.35);return s.hall(.1),Math.max(a,e+.4)}stoneHitBear(t,e,n,i,s){return this.thump(t,n,e,100*i,45*i,.5,.08,.1),this.burst(t,n,e,"white","lowpass",650*i,1.2,.9,.002,.03),this.burst(t,n,e,"pink","bandpass",1800*i,.8,.35,.004,.05),this.ping(t,n,e,380*i,.12,.02),s.hall(.08),e+.6}staffHit(t,e,n,i,s){const o=et(360,460)*i;return this.ping(t,n,e,o,.32,.045),this.ping(t,n,e,o*2.31,.2,.025),this.ping(t,n,e,o*3.87,.11,.015),this.burst(t,n,e,"white","bandpass",1600*i,.9,.3,8e-4,.008),this.thump(t,n,e,140*i,70*i,.4,.05,.05),s.hall(.1),e+.45}pickup(t,e,n,i){for(let s=0;s<2;s++){const o=e+s*et(.05,.075),a=et(2500,3600)*i*(s?.92:1),c=s?.55:1;this.ping(t,n,o,a,.28*c,.012),this.ping(t,n,o,a*1.47,.16*c,.008),this.burst(t,n,o,"white","highpass",3e3,.7,.35*c,5e-4,.003)}return this.thump(t,n,e,300*i,180*i,.12,.02,.03),e+.35}human(t,e,n,i,s,o){const a=s==="hurt",c=(a?et(160,200):et(175,215))*i,l=a?et(.22,.32):et(.16,.24),h=e+(a?0:.025),d=a?[620,1150,2450]:[760,1250,2650],f=t.osc("sawtooth",c,0,h);a?un(f.frequency,h,l,[[0,1.05],[.15,1.18],[.6,.95],[1,.72]],c):un(f.frequency,h,l,[[0,1.08],[.3,1],[1,.8]],c);const u=t.osc("sine",et(18,28),0,e),m=t.gain(c*.025);u.connect(m),m.connect(f.frequency);const v=t.shaper(this.c.curve("drive",a?3:1.5)),p=t.gain(0);f.connect(v),v.connect(p);const g=t.noise("white",e),x=t.filter("highpass",500,.6),_=t.gain(0);g.connect(x),x.connect(_);const y=t.gain(1);p.connect(y),_.connect(y);const w=t.gain(1),T=[1,.55,.25];d.forEach((M,S)=>{const k=t.filter("bandpass",M*et(.95,1.05),6+S*2),N=t.gain(T[S]*2.5);y.connect(k),k.connect(N),N.connect(w)});const R=t.filter("lowpass",400,.7),E=t.gain(.3);y.connect(R),R.connect(E),E.connect(w);const D=t.gain(o);return w.connect(D),D.connect(n),a?(un(p.gain,e,l,[[0,0],[.08,.9],[.4,.7],[1,0]]),un(_.gain,e,l,[[0,0],[.05,.5],[.5,.25],[1,0]])):(un(_.gain,e,l+.03,[[0,0],[.1,.8],[.5,.5],[1,0]]),un(p.gain,h,l,[[0,0],[.15,.5],[.5,.35],[1,0]])),e+l+.1}bleat(t,e,n,i,s,o){const a=Dy[s],c=et(a.f[0],a.f[1])*i,l=et(a.dur[0],a.dur[1])/Math.sqrt(i),h=s==="sheep"&&je(.3),d=t.constant(c,e),f=a.pulse?t.wave(this.c.wave("pulse"),0,0,e):t.osc("sawtooth",0,0,e);d.connect(f.frequency);const u=t.osc("sine",et(a.vib[0],a.vib[1]),0,e),m=t.gain(c*a.fm);u.connect(m),m.connect(d.offset);const v=t.gain(1-a.am/2),p=t.gain(a.am/2);u.connect(p),p.connect(v.gain),f.connect(v);const g=t.noise("white",e),x=t.filter("highpass",1500,.7),_=t.gain(a.breath);g.connect(x),x.connect(_);const y=t.gain(1);v.connect(y),_.connect(y);const w=t.gain(1);let T=null;const R=a.formants[0][0]*et(.93,1.07);a.formants.forEach(([S,k,N],z)=>{const H=t.filter("bandpass",z===0?R:S*et(.93,1.07),k),L=t.gain(N*2.2);y.connect(H),H.connect(L),L.connect(w),z===0&&(T=H)});const E=t.filter("lowpass",c*2.5,.7),D=t.gain(.35);y.connect(E),E.connect(D),D.connect(w);const M=t.gain(0);return w.connect(M),M.connect(n),un(d.offset,e,l,h?[[0,.92],[.15,1.04],[.45,1],[.55,.96],[.65,1],[1,.84]]:[[0,.9],[.18,1.05],[.6,1],[1,.85]],c),T&&un(T.frequency,e,l,[[0,.5],[.1,1],[.8,.95],[1,.6]],R),un(M.gain,e,l,h?[[0,0],[.05,.9],[.4,.85],[.47,.3],[.55,.95],[.85,.7],[1,0]]:[[0,0],[.06,.85],[.2,1],[.8,.8],[1,0]],a.level),o.hall(.1),e+l+.05}beast(t,e,n,i,s,o){const a=Iy[s],c=this.c,l=et(a.dur[0],a.dur[1])/Math.sqrt(i),h=et(.9,1.1)*i,d=t.constant(a.f0[0][1]*h,e),f=t.osc("sawtooth",0,-12,e),u=t.osc("sawtooth",0,14,e),m=t.osc("triangle",0,0,e);d.connect(f.frequency),d.connect(u.frequency);const v=t.gain(.5);d.connect(v),v.connect(m.frequency);const p=t.osc("sine",et(5,9),0,e),g=t.gain(a.f0[0][1]*h*.04);p.connect(g),g.connect(d.offset);const x=t.gain(1),_=t.gain(.5),y=t.gain(.4),w=t.gain(.7);f.connect(_),u.connect(y),m.connect(w),_.connect(x),y.connect(x),w.connect(x);const T=t.noise("white",e),R=t.filter("bandpass",700,.6),E=t.gain(0);T.connect(R),R.connect(E),E.connect(x);const D=t.gain(1-a.raspDepth/2),M=t.osc("triangle",a.rasp[0],0,e),S=t.gain(a.raspDepth/2);M.connect(S),S.connect(D.gain),x.connect(D);const k=t.osc("sine",et(2,4),0,e),N=t.gain(a.rasp[0]*.3);k.connect(N),N.connect(M.frequency);const z=t.shaper(c.curve("drive",a.drive));D.connect(z);const H=t.gain(1),L=t.filter("bandpass",400,3.5),V=t.filter("bandpass",900,5),O=t.filter("bandpass",2300*i,6),P=[[L,1.6],[V,.9],[O,.25]];for(const[Z,rt]of P){const J=t.gain(rt);z.connect(Z),Z.connect(J),J.connect(H)}const B=t.filter("lowpass",320,.8),G=t.gain(.6);z.connect(B),B.connect(G),G.connect(H);const Q=t.filter("lowpass",2500,.7),ut=t.gain(0);H.connect(Q),Q.connect(ut),ut.connect(n);const X=Math.sqrt(i);return un(d.offset,e,l,a.f0,h),un(L.frequency,e,l,a.F1,X),un(V.frequency,e,l,a.F1,2.1*X),un(ut.gain,e,l,a.amp,a.level),un(E.gain,e,l,a.noise),M.frequency.setValueAtTime(a.rasp[0],e),M.frequency.linearRampToValueAtTime(a.rasp[1],e+l),o.hall(a.wet),o.echo(a.echo),e+l+.1}shepherdCall(t,e,n,i){const s=Math.round(12*Math.log2(n)),a=wn([[[69,.16],[74,.38],[76,.1],[74,.13],[69,.62]],[[67,.13],[69,.13],[74,.4],[72,.09],[74,.12],[69,.6]],[[69,.15],[72,.14],[74,.36],[76,.09],[74,.12],[71,.12],[69,.55]]]).map(([l,h])=>({midi:l+s,dur:h*et(.94,1.06)})),c=this.syn.ney({dry:e,wet:null},t,a,.16);return i.echo(.42),i.hall(.22),c+.35}shepherdWhistle(t,e,n,i,s){const o=this.c,a=et(1250,1450)*i,c=a*et(1.3,1.42),l=a*et(.86,.95),h=et(.22,.28),d=et(.07,.1),f=et(.34,.42),u=e+h+d,m=u+f,v=t.osc("sine",a,0,e),p=t.osc("sine",a*2,0,e),g=t.gain(.04),x=t.osc("sine",et(4.5,6),0,e),_=t.gain(14);x.connect(_),_.connect(v.detune),_.connect(p.detune);const y=v.frequency,w=p.frequency;y.setValueAtTime(a,e),y.exponentialRampToValueAtTime(c,e+h*.7),y.setValueAtTime(c,u),y.exponentialRampToValueAtTime(l,u+f*.6),y.exponentialRampToValueAtTime(l*.97,m),w.setValueAtTime(a*2,e),w.exponentialRampToValueAtTime(o.hz(c*2),e+h*.7),w.setValueAtTime(o.hz(c*2),u),w.exponentialRampToValueAtTime(l*2,u+f*.6),w.exponentialRampToValueAtTime(l*1.94,m);const T=t.gain(0);v.connect(T),p.connect(g),g.connect(T);const R=t.noise("white",e),E=t.filter("bandpass",c,4),D=t.gain(0);R.connect(E),E.connect(D),E.frequency.setValueAtTime(o.hz(a),e),E.frequency.exponentialRampToValueAtTime(o.hz(c),e+h*.7),E.frequency.setValueAtTime(o.hz(c),u),E.frequency.exponentialRampToValueAtTime(o.hz(l),u+f*.6);const M=.13,S=.05;for(const[k,N]of[[e,e+h],[u,m]]){const z=T.gain,H=D.gain;z.setValueAtTime(0,k),z.linearRampToValueAtTime(M,k+.03),z.linearRampToValueAtTime(M*.85,N-.05),z.linearRampToValueAtTime(0,N),H.setValueAtTime(0,k),H.linearRampToValueAtTime(S,k+.02),H.linearRampToValueAtTime(S*.4,k+.08),H.linearRampToValueAtTime(0,N)}return T.connect(n),D.connect(n),s.echo(.35),s.hall(.2),m+.1}titleHit(t,e,n,i){const s={dry:n,wet:null},o=this.syn;return this.sample(t,n,e,"boom",1,1),o.drum(s,e+.004,"taiko",.9,-.35),o.drum(s,e+.022,"taiko",.8,.35),o.drum(s,e,"dum",.7,0),o.choir(s,e+.02,5.5,[50,57,62,65,69,74],{level:.34,attack:.1,release:3,vowel:"ah",breath:.2}),o.pad(s,e,5,[26,38,45,50],{level:.22,attack:.06,release:3,cutoff:1400,cutoffEnd:500,voices:3,detune:10}),o.shofar(s,e+.18,"tekiah",.4),this.burst(t,n,e,"white","highpass",6e3,.7,.08,.01,1.1),i.hall(.55),i.echo(.12),this.onTitleHit&&this.onTitleHit(e),e+7}}const Ou=.68,xr={title:.85,pastoral:.9,tension:1,battle:.95,victory:.95},Hu=["pointerdown","keydown","touchend"];class Uy{constructor(){b(this,"ctx",null);b(this,"core",null);b(this,"lib",null);b(this,"syn",null);b(this,"amb",null);b(this,"sling",null);b(this,"title",null);b(this,"moods",new Map);b(this,"_ready",!1);b(this,"pending",null);b(this,"timer",null);b(this,"unlock",null);b(this,"vol",.8);b(this,"muted",!1);b(this,"musicVol",1);b(this,"sfxVol",1);b(this,"mood","silence");b(this,"moodFade",3);b(this,"amblv",{wind:0,cicadas:0,birds:0});b(this,"slowTarget",0);b(this,"slowAmt",0);b(this,"slowApplied",-1);b(this,"autoBeat",!0);b(this,"nextBeat",0);b(this,"lastTick",0);b(this,"nextSweep",0);b(this,"nextWarm",0)}get ready(){return this._ready}get context(){return this.ctx}get currentMood(){return this.mood}init(){return this._ready&&this.ctx?this.ctx.state!=="running"?this.ctx.resume().catch(()=>{}):Promise.resolve():(this.pending||(this.pending=this.boot().finally(()=>{this.pending=null})),this.pending)}async boot(){let t=Promise.resolve();try{const e=window,n=e.AudioContext||e.webkitAudioContext;if(!n){console.warn("[AudioEngine] Web Audio API not available");return}let i;try{i=new n({latencyHint:"interactive"})}catch{i=new n}i.state!=="running"&&typeof i.resume=="function"&&(t=Promise.race([i.resume().catch(()=>{}),new Promise(a=>setTimeout(a,400))]));const s=new ay(i),o=new ly(s);if(this.ctx=i,this.core=s,this.syn=o,this.title=new dy(s,o,xr.title),this.moods.set("title",this.title),this.moods.set("pastoral",new my(s,o,xr.pastoral)),this.moods.set("tension",new vy(s,o,xr.tension)),this.moods.set("battle",new yy(s,o,xr.battle)),this.moods.set("victory",new Sy(s,o,xr.victory)),this.lib=new Ny(s,o),this.lib.onTitleHit=a=>{this.title&&this.title.reveal(a)},this.amb=new Ay(s),this.sling=new Cy(s),s.master.gain.value=this.vol,s.mute.gain.value=this.muted?0:1,s.musicIn.gain.value=Ou*this.musicVol,s.sfxWorld.gain.value=this.sfxVol,s.uiIn.gain.value=this.sfxVol,this.amb.setLevels(this.amblv,i.currentTime),this._ready=!0,this.lastTick=i.currentTime,this.nextWarm=i.currentTime+.05,this.applyMood(this.moodFade),this.timer=setInterval(()=>this.tick(),40),typeof window<"u"&&typeof window.addEventListener=="function"){const a=()=>{const c=this.ctx;c&&c.state!=="running"&&c.state!=="closed"&&c.resume().catch(()=>{})};for(const c of Hu)window.addEventListener(c,a,{capture:!0,passive:!0});this.unlock=a}this.tick()}catch(e){console.warn("[AudioEngine] init failed",e),this.teardown();return}await t}setMasterVolume(t){this.vol=Re(Rn(t,this.vol),0,1);const e=this.core;e&&e.master.gain.setTargetAtTime(this.vol,e.ctx.currentTime,.03)}setMuted(t){this.muted=!!t;const e=this.core;e&&e.mute.gain.setTargetAtTime(this.muted?0:1,e.ctx.currentTime,.04)}setMusicVolume(t){this.musicVol=Re(Rn(t,this.musicVol),0,1);const e=this.core;e&&e.musicIn.gain.setTargetAtTime(Ou*this.musicVol,e.ctx.currentTime,.05)}setSfxVolume(t){this.sfxVol=Re(Rn(t,this.sfxVol),0,1);const e=this.core;e&&(e.sfxWorld.gain.setTargetAtTime(this.sfxVol,e.ctx.currentTime,.05),e.uiIn.gain.setTargetAtTime(this.sfxVol,e.ctx.currentTime,.05))}setMusicMood(t,e=3){const n=t==="title"||t==="pastoral"||t==="tension"||t==="battle"||t==="victory"?t:"silence",i=Re(Rn(e,3),0,30);n===this.mood&&this.core||(this.mood=n,this.moodFade=i,this.applyMood(i))}applyMood(t){const e=this.core;if(!e)return;const n=e.ctx.currentTime;for(const[i,s]of this.moods)try{i===this.mood?s.activate(n,t):s.deactivate(n,t)}catch{}}setAmbience(t){if(!(!t||typeof t!="object")){for(const e of["wind","cicadas","birds"]){const n=t[e];n!==void 0&&(this.amblv[e]=Re(Rn(n,this.amblv[e]),0,1))}if(this.amb&&this.core)try{this.amb.setLevels(this.amblv,this.core.ctx.currentTime)}catch{}}}sfx(t,e){if(!(!this._ready||!this.lib||!this.core))try{this.lib.play(t,e,this.core.ctx.currentTime)}catch{}}playLyre(t,e=.7){if(!(!this._ready||!this.syn||!this.core))try{const n=Re(Math.round(Rn(t,62)),36,96),i=Re(Rn(e,.7),0,1);this.syn.lyre({dry:this.core.uiIn,wet:null},this.core.ctx.currentTime+.01,n,i,os(n))}catch{}}slingSpin(t,e){if(!(!this._ready||!this.sling||!this.core))try{this.sling.set(!!t,e,this.core.ctx.currentTime)}catch{}}setSlowMotion(t){this.slowTarget=Re(Rn(t,0),0,1),this._ready&&Math.abs(this.slowTarget-this.slowAmt)>.05&&this.tick()}setAutoHeartbeat(t){this.autoBeat=!!t}update(t){this._ready&&this.tick()}dispose(){this.teardown()}tick(){const t=this.core;if(!t||!this._ready)return;const e=t.ctx.currentTime,n=Re(e-this.lastTick,0,.25);this.lastTick=e,this.slowAmt+=(this.slowTarget-this.slowAmt)*(1-Math.exp(-n*6)),Math.abs(this.slowTarget-this.slowAmt)<.002&&(this.slowAmt=this.slowTarget),Math.abs(this.slowAmt-this.slowApplied)>.003&&(this.slowApplied=this.slowAmt,this.applySlow(e));const i=typeof document<"u"&&document.hidden,s=e+(i?1.5:.3);for(const o of this.moods.values())try{o.schedule(e,s)}catch{}try{this.amb&&this.amb.tick(e,this.slowAmt)}catch{}try{this.sling&&this.sling.tick(e)}catch{}if(this.autoBeat&&this.lib&&this.slowAmt>.15&&e>=this.nextBeat){try{this.lib.play("heartbeat",{volume:.2+.4*this.slowAmt},e)}catch{}this.nextBeat=e+Xn(.95,1.2,this.slowAmt)}if(e>=this.nextSweep&&(t.sweep(e),this.nextSweep=e+.5),e>=this.nextWarm){this.nextWarm=e+.03;try{t.warm()}catch{}}}applySlow(t){const e=this.core;if(!e)return;const n=this.slowAmt;e.slowFilter.frequency.setTargetAtTime(e.hz(J_(18e3,600,n)),t,.05),e.slowFilter.Q.setTargetAtTime(.7+.6*n,t,.05),e.musicDuck.gain.setTargetAtTime(1-.3*n,t,.08),e.slowVerb.gain.setTargetAtTime(.4*n,t,.08),e.slowPitch=1-.2*n}teardown(){if(this.timer!==null&&(clearInterval(this.timer),this.timer=null),this.unlock&&typeof window<"u"){for(const e of Hu)window.removeEventListener(e,this.unlock,{capture:!0});this.unlock=null}try{this.sling&&this.sling.teardown()}catch{}try{this.amb&&this.amb.dispose()}catch{}try{this.core&&this.core.dispose()}catch{}const t=this.ctx;this._ready=!1,this.ctx=null,this.core=null,this.lib=null,this.syn=null,this.amb=null,this.sling=null,this.title=null,this.moods.clear(),this.slowApplied=-1,t&&t.state!=="closed"&&typeof t.close=="function"&&t.close().catch(()=>{})}}class zy{constructor(t){b(this,"engine",new Uy);this.camera=t}init(){return this.engine.init()}sfx(t,e){try{this.engine.sfx(t,e)}catch{}}at(t,e,n=1,i=1,s=60){const o=this.camera,a=o.position.distanceTo(e);if(a>s)return;const c=Math.min(1,3/Math.max(3,a))*(1-a/s)**.5,l=e.clone().applyMatrix4(Fy.copy(o.matrixWorld).invert()),h=Bt.clamp(l.x/Math.max(2,Math.abs(l.z)+Math.abs(l.x)),-.9,.9);this.sfx(t,{volume:n*c,pitch:i,pan:h})}music(t,e=3){this.engine.setMusicMood(t,e)}ambience(t,e,n){this.engine.setAmbience({wind:t,cicadas:e,birds:n})}slingSpin(t,e){this.engine.slingSpin(t,e)}slowMo(t){this.engine.setSlowMotion(t)}update(t){this.engine.update(t)}setVolume(t){this.engine.setMasterVolume(t)}}const Fy=new Dt;class Vu extends Error{}const ze={move:{key:"W A S D",touch:"ג׳ויסטיק",label:"תנועה"},look:{key:"עכבר",touch:"גרירה",label:"מצלמה"},run:{key:"Shift",touch:"דחיפה לקצה",label:"ריצה"},call:{key:"Q",touch:"קְרִיאָה",label:"קריאה לצאן"},interact:{key:"E",touch:"פְּעֻלָּה",label:""},sling:{key:"לחצן שמאלי",touch:"קֶלַע",label:"החזק — סובב את הקלע · שחרר — קלע"},strike:{key:"F",touch:"מַקֵּל",label:"הכאה במקל"},dodge:{key:"Space",touch:"הִתְחַמֵּק",label:"התחמקות"}},_r=(r,t)=>({...r,label:t});class By{constructor(t,e,n,i,s,o,a,c,l,h){b(this,"timeScale",1);b(this,"slowTarget",1);b(this,"time",0);b(this,"gen",0);b(this,"waits",[]);b(this,"timers",[]);b(this,"realTime",0);b(this,"markerPos",null);b(this,"markerLabel","");b(this,"markerFn",null);b(this,"bossHP",1);b(this,"showBoss",!1);b(this,"showHealth",!1);b(this,"beh",null);b(this,"bearThreats",[]);b(this,"paused",!1);b(this,"freeRoam",!1);b(this,"lambHome",new A);b(this,"jarsBroken",0);b(this,"bearVulnerable",!1);b(this,"bearHitCB",null);b(this,"runningGen",0);b(this,"jump","");this.engine=t,this.ui=e,this.input=n,this.audio=i,this.cam=s,this.player=o,this.flock=a,this.bear=c,this.props=l,this.projectiles=h;for(const u of l.jars)h.targets.push({id:"jar",center:()=>u.center,radius:.26,enabled:()=>u.alive,onHit:(m,v)=>{u.shatter(v),this.audio.at("jarShatter",u.center,1),this.engine.particles.dustBurst(u.center,10,.8,new dt(.72,.45,.3)),this.jarsBroken++}});const d=[],f=(u,m)=>({id:"bear",center:()=>this.bear.model.hitPoints(d)[u],radius:m,enabled:()=>this.bear.visible&&this.bear.alive&&this.bearVulnerable,onHit:v=>this.hitBear(v,"sling")});h.targets.push(f(1,.55),f(2,.32),f(0,.5)),h.onGroundHit=(u,m)=>{m>6&&(this.audio.at("stoneHit",u,.8),this.engine.particles.dustBurst(u,5,.6))},o.onStrikeImpact=u=>this.onStaffImpact(u)}after(t,e,n=!1){this.timers.push({at:(n?this.realTime:this.time)+t,fn:e,gen:this.gen,real:n})}until(t){const e=this.gen;return new Promise((n,i)=>{if(t())return n();this.waits.push({until:t,resolve:n,reject:i,gen:e})})}wait(t){const e=this.time+t;return this.until(()=>this.time>=e)}check(){}start(t=!1){this.gen++;for(const e of this.waits)e.reject(new Vu);this.waits=[],this.runningGen=this.gen,this.run(t).catch(e=>{e instanceof Vu||console.error(e)})}setMarker(t,e=""){this.markerFn=typeof t=="function"?t:null,this.markerPos=typeof t=="function"?null:t,this.markerLabel=e}slowMo(t){this.slowTarget=t}flockCenter(){const t=new A;let e=0;for(const n of this.flock.animals)n.state!=="carried"&&(t.add(n.position),e++);return e?t.multiplyScalar(1/e):this.flock.pastureCenter.clone()}groundV(t,e,n=0){return new A(t,this.engine.terrain.heightAt(t,e)+n,e)}shots(t){return new Promise(e=>this.cam.playShots(t,e))}cinematic(t){this.ui.letterbox(t),this.ui.hud(!t),this.player.controlEnabled=!t,this.input.setTouchVisible(!t),t&&(this.ui.prompt(null),this.ui.crosshair(!1))}async run(t){const e=Xt;if(this.resetWorld(),this.ui.fade(1,0),await this.wait(.3),this.jump){this.cam.stop(),await this.debugJump(this.jump);return}t?(this.cam.stop(),this.ui.fade(0,1.5),this.cam.snapBehind(this.player.heading,.15)):await this.intro(),this.check(),this.cinematic(!1),this.audio.music("pastoral",4),this.ui.objective("לֵךְ אֶל הַצֹּאן","הָעֵדֶר רוֹעֶה בַּמִּרְעֶה שֶׁבְּמוֹרַד הַגִּבְעָה"),this.ui.hint([ze.move,ze.look,ze.run]),this.setMarker(()=>this.flockCenter().add(new A(0,1.5,0)),"הַצֹּאן"),await this.until(()=>this.player.pos.distanceTo(this.flockCenter())<17||this.flock.countNear(this.player.pos,8)>=3),this.check(),this.ui.hint(null),this.audio.sfx("uiObjective"),this.ui.objective("קְרָא לַצֹּאן","אֱסֹף אֶת הָעֵדֶר אֵלֶיךָ"),this.ui.hint([ze.call]),this.setMarker(null);let n=!1;this.beh=()=>{!n&&this.input.take("call")&&(n=!0,this.player.model.play("call"),this.audio.sfx("shepherdCall",{volume:.9}),this.after(.35,()=>this.flock.call(this.player.pos)))},await this.until(()=>n),this.check(),this.ui.hint(null),await this.wait(2.5),this.ui.toast("מִדְרָשׁ",`${zs("shr_2_2_flock")}<small>${Io("shr_2_2_flock")}</small>`,16),await this.wait(3),this.check(),this.ui.objective("לַקֵּט חֲמִשָּׁה חַלֻּקֵי אֲבָנִים מִן הַנַּחַל","כְּפִי שֶׁיַּעֲשֶׂה יוֹם אֶחָד בְּעֵמֶק הָאֵלָה");const i=this.groundV(e.stones.x,e.stones.z,.6),s=()=>{let d=null,f=1/0;for(const u of this.props.stones){if(u.taken)continue;const m=u.mesh.position.distanceTo(this.player.pos);m<f&&(f=m,d=u.mesh.position)}return{pos:d,dist:f}};this.setMarker(()=>{const d=s();return d.pos?this.player.pos.distanceTo(i)>28?i:d.pos.clone().add(new A(0,.9,0)):null},"הַנַּחַל");let o=0,a=!1;this.ui.counter("חַלֻּקֵי אֲבָנִים <b>0 / 5</b>"),this.beh=()=>{this.props.setStoneGlint(!0,this.time);let d=null,f=2.4;for(const u of this.props.stones){if(u.taken)continue;const m=Math.hypot(u.mesh.position.x-this.player.pos.x,u.mesh.position.z-this.player.pos.z);m<f&&(f=m,d=u)}if(this.ui.prompt(d&&!a?_r(ze.interact,"אֱסֹף אֶבֶן חֲלָקָה"):null),d&&!a&&this.input.take("interact")){a=!0;const u=d;let m=!1;const v=()=>{m||(m=!0,u.taken=!0,u.setVisible(!1),o++,this.audio.sfx("pickup"),this.ui.counter(`חַלֻּקֵי אֲבָנִים <b>${o} / 5</b>`),a=!1)};this.player.faceToward(u.mesh.position,1,100),this.player.model.play("pick",[{t:.5,fn:v}]),this.after(1.1,v,!0)}},await this.until(()=>o>=5),this.check(),this.props.setStoneGlint(!1,0),this.ui.prompt(null),this.ui.counter(null),this.audio.sfx("uiObjective"),this.ui.verse(..._n("s1_17_40_stones"),6),await this.wait(2),this.player.canSling=!0,this.ui.objective("הִתְאַמֵּן בַּקֶּלַע","נַפֵּץ אֶת שְׁלֹשֶׁת הַכַּדִּים שֶׁעַל הַגָּדֵר"),this.ui.hint([ze.sling,_r(ze.look,"כַּוֵּן")]);const c=this.props.jars[1].center.clone().add(new A(0,.8,0));this.setMarker(c,"הַכַּדִּים"),this.jarsBroken=0,this.ui.counter("כַּדִּים <b>0 / 3</b>");let l=0;this.beh=()=>{this.jarsBroken!==l&&(l=this.jarsBroken,this.ui.counter(`כַּדִּים <b>${this.jarsBroken} / 3</b>`),this.jarsBroken===1&&this.ui.verse(..._n("jdg_20_16_slingers"),6)),this.player.throws===4&&this.jarsBroken===0&&(this.ui.hint('<span class="h-item">טיפ: סובב את הקלע זמן רב יותר — הטבעת מתמלאת — כדי שהאבן תגיע רחוק ובקו ישר יותר</span>',8),this.player.throws++)},await this.until(()=>this.jarsBroken>=3),this.check(),this.ui.counter(null),this.audio.sfx("uiObjective"),this.player.canStrike=!0,this.player.canDodge=!0,this.ui.hint([ze.strike,ze.dodge],9),await this.wait(2.5),this.ui.objective("חֲזֹר אֶל הָעֵדֶר","אַל תַּשְׁאִיר אֶת הַצֹּאן לְבַד זְמַן רַב"),this.setMarker(()=>this.flockCenter().add(new A(0,1.5,0)),"הַצֹּאן");const h=this.time;this.beh=null,await this.until(()=>this.player.pos.distanceTo(this.flockCenter())<20||this.time-h>70),this.check(),await this.bearAttack(),this.check(),await this.chase(),this.check(),await this.rescue(),this.check(),await this.rise(),this.check(),await this.fight(),this.check(),await this.clinch(),this.check(),await this.aftermath(),this.check(),await this.ending()}async debugJump(t){this.ui.fade(0,.5),this.cinematic(!1),this.audio.music("pastoral",1);const e=this.flockCenter();if(this.player.place(e.x-12,e.z-12,.7),this.cam.snapBehind(.7,.15),this.player.canSling=this.player.canStrike=this.player.canDodge=!0,t==="sling"){this.player.place(Xt.targets.x-10,Xt.targets.z-8,.9),this.cam.snapBehind(.9,.1);return}if(await this.bearAttack(),t==="bear"){await this.chase(),await this.rescue(),await this.rise(),await this.fight(),await this.clinch(),await this.aftermath(),await this.ending();return}this.bear.hits=3;const n=new A(Math.sin(this.bear.heading),0,Math.cos(this.bear.heading));if(this.player.place(this.bear.pos.x+n.x*2.4,this.bear.pos.z+n.z*2.4,this.bear.heading+Math.PI),await this.rescue(),await this.rise(),t==="fight"){await this.fight(),await this.clinch(),await this.aftermath(),await this.ending();return}await this.clinch(),await this.aftermath(),await this.ending()}resetWorld(){const t=Xt;this.player.place(t.start.x+.2,t.start.z+2.3,.46),this.player.health=this.player.maxHealth,this.player.canSling=this.player.canStrike=this.player.canDodge=!1,this.player.carrying=!1,this.player.model.hold="none",this.player.model.staffMode="plant",this.bear.visible=!1,this.bear.alive=!0,this.bear.hits=0,this.bear.model.hold="none",this.bear.model.roar=0,this.bear.model.lookTarget=null,this.bear.place(t.bearLair.x,t.bearLair.z,Math.PI),this.bearVulnerable=!1,this.showBoss=!1,this.showHealth=!1,this.bossHP=1,this.beh=null,this.setMarker(null),this.ui.objective(null),this.ui.counter(null),this.ui.prompt(null),this.ui.qte(null),this.ui.endCard(!1),this.freeRoam=!1,this.props.reset(),this.jarsBroken=0,this.player.throws=0;const e=this.flock.lamb;e.object.parent!==this.flock.group&&(this.flock.group.attach(e.object),e.object.position.set(t.pasture.x,this.engine.terrain.heightAt(t.pasture.x,t.pasture.z),t.pasture.z),e.object.rotation.set(0,0,0),e.setCarried("none")),this.slowTarget=1,this.timeScale=1}async intro(){const t=Xt;this.cinematic(!0),this.ui.skip(!0),this.audio.music("title",1.5),this.audio.ambience(.55,.7,.45),this.ui.fade(0,3);const e=(p,g,x)=>this.groundV(p,g,x),n=()=>this.player.pos,i=t.bethlehem,s=t.rachel,o=()=>this.flock.lamb.position,a=this.player.heading,c=new A(Math.sin(a),0,Math.cos(a)),l=this.player.pos.clone(),h=[sc(8.5,To(640,150,560),To(330,85,300),To(-120,20,-200),To(-230,20,-300),40,36),sc(7,e(i.x+205,i.z+150,16),e(i.x+150,i.z+95,11),e(i.x,i.z,12),e(i.x-10,i.z-10,10),40,36),sc(6.5,e(s.x+14,s.z+9,2.2),e(s.x+6,s.z+4,1.8),e(s.x,s.z,2.6),e(s.x-30,s.z-40,10),38,34),{duration:7,at:p=>{const g=o(),x=1.25+p*.55;return{pos:new A(g.x+Math.sin(x)*(4.2-p*1.5),g.y+.7+p*.2,g.z+Math.cos(x)*(4.2-p*1.5)),look:g.clone().add(new A(0,.35,0)),fov:34}}},rc(10,n,5.2,3.2,a-.95,a-.1,.5,1.2,1.35,36),{duration:9.5,at:p=>{const g=l.clone().addScaledVector(c,-(2.6+p*7)).add(new A(.8+p*2,1.8+p*5.5,0)),x=l.clone().addScaledVector(c,30+p*60).add(new A(0,1.2-p*4,0));return{pos:g,look:x,fov:44+p*6}}}];let d=0;const f=[[1.2,()=>this.ui.caption("הָרֵי יְהוּדָה","אֶרֶץ יִשְׂרָאֵל · בִּימֵי שָׁאוּל הַמֶּלֶךְ")],[9.3,()=>this.ui.caption("בֵּית לֶחֶם יְהוּדָה","עִירוֹ שֶׁל יִשַׁי בֶּן עוֹבֵד")],[11.2,()=>this.ui.verse(..._n("s1_17_12_ephrathite"),4.6)],[16.2,()=>this.ui.caption("מַצֶּבֶת קְבֻרַת רָחֵל",Kx("gen_35_19_rachel_buried"))],[22.8,()=>this.ui.verse(..._n("s1_16_11_youngest"),5)],[29.5,()=>this.ui.verse(..._n("s1_16_12_ruddy"),6)],[39.2,()=>{this.ui.hideVerse(),this.ui.titleCard(!0),this.audio.sfx("titleHit")}],[46.5,()=>this.ui.titleCard(!1)]],u=this.shots(h);let m=!1;u.then(()=>m=!0),this.ui.onSkip=()=>this.cam.skipShots();let v=0;this.beh=p=>{for(d+=p;v<f.length&&d>=f[v][0];)f[v++][1]();(this.input.take("skip")||this.input.take("pause"))&&this.cam.skipShots(),this.player.model.lookTarget=this.engine.camera.position},await this.until(()=>m),this.check(),this.beh=null,this.ui.skip(!1),this.player.model.lookTarget=null,d<44?(this.ui.hideVerse(),this.ui.titleCard(!0),d<39&&this.audio.sfx("titleHit"),setTimeout(()=>this.ui.titleCard(!1),4200)):setTimeout(()=>this.ui.titleCard(!1),800),this.cam.snapBehind(this.player.heading,.15)}async bearAttack(){const t=this.flock.lamb,e=this.flockCenter(),n=Xt.thicket,i=new A(n.x-e.x,0,n.z-e.z).normalize(),s=e.clone().addScaledVector(i,11);t.goTo(s,1);const o=e.clone().addScaledVector(i,52);this.bear.place(o.x,o.z,Math.atan2(-i.x,-i.z)),this.bear.visible=!0,this.bear.model.hold="none",this.cinematic(!0),this.audio.music("tension",1.5),this.audio.ambience(.6,.15,0);const a=()=>this.bear.pos;let c="stalk",l=0,h=!1;this.beh=f=>{l+=f;const u=t.position;if(c==="stalk")this.bear.moveTo(u,1.4,f),l>2.2&&(c="charge",this.audio.at("bearGrowl",this.bear.pos,1),this.flock.panic(this.bear.pos));else if(c==="charge")this.bear.moveTo(t.object.getWorldPosition(new A),8.5,f,1.1)&&(c="grab",this.grabLamb(),h=!0,l=0);else if(c==="grab")this.bear.stop(f),l>1.3&&(c="away");else{const m=new A(n.x,0,n.z);this.bear.moveTo(m,3.5,f)}this.bearThreats[0]=this.bear.pos};const d=s.clone();await this.shots([{duration:3.6,at:f=>({pos:d.clone().addScaledVector(i,-6).add(new A(1.5,1+f*.3,0)),look:a().clone().add(new A(0,.8,0)),fov:40-f*6})},{duration:3.2,at:f=>{const u=a(),m=new A(-i.z,0,i.x);return{pos:u.clone().addScaledVector(m,5-f).add(new A(0,.9,0)).addScaledVector(i,2),look:u.clone().add(new A(0,.7,0)),fov:42}}},{duration:3.4,at:f=>{const u=a();return{pos:u.clone().add(new A(0,1.3+f*.4,0)).addScaledVector(i,-3.2).add(new A(-i.z*1.8,0,i.x*1.8)),look:u.clone().add(new A(0,.9,0)),fov:34}}},{duration:3.2,at:f=>{const u=this.player.pos,m=new A(Math.sin(this.player.heading),0,Math.cos(this.player.heading));return{pos:u.clone().addScaledVector(m,1.8-f*.3).add(new A(.5,1.55,0)),look:u.clone().add(new A(0,1.55,0)),fov:32}}}]),this.check(),h||this.grabLamb(!0),this.ui.verse(..._n("s1_17_34_bear"),5),this.player.model.lookTarget=null}grabLamb(t=!1){const e=this.flock.lamb,n=this.bear.model.mouthSocket;t&&this.bear.place(e.position.x+1,e.position.z+1,this.bear.heading),this.bear.model.root.updateMatrixWorld(!0),e.object.updateMatrixWorld(!0);const i=e.object.worldToLocal(e.backGrip.getWorldPosition(new A));n.add(e.object),e.setCarried("mouth"),e.object.rotation.set(0,Math.PI/2,0),e.object.position.copy(i.applyEuler(e.object.rotation).multiplyScalar(-1)),this.bear.model.hold="carry",this.audio.at("lambBleat",this.bear.pos,1),this.audio.at("bearGrowl",this.bear.pos,.8)}hitBear(t,e){this.bear.alive&&(this.bear.hits++,this.audio.at(e==="sling"?"stoneHitBear":"staffHit",t,1),this.audio.at("bearHurt",this.bear.pos,.9),this.engine.particles.dustBurst(t,6,.5,new dt(.55,.42,.3)),this.bear.model.busy||this.bear.model.play("hurt"),this.cam.addShake(e==="staff"?.6:.25),this.bearHitCB?.(e))}onStaffImpact(t){for(const e of this.props.jars)e.alive&&t.distanceTo(e.center)<.6&&(e.shatter(this.player.forward),this.audio.at("jarShatter",e.center,1),this.jarsBroken++);if(this.bear.visible&&this.bear.alive&&this.bearVulnerable){const e=this.bear.model.hitPoints([]);let n=1/0;for(const s of e)n=Math.min(n,s.distanceTo(t));const i=Math.hypot(this.bear.pos.x-this.player.pos.x,this.bear.pos.z-this.player.pos.z);(n<1||i<1.9)&&this.hitBear(t,"staff")}}async chase(){const t=Xt.thicket,e=new A(t.x,0,t.z);this.cinematic(!1),this.audio.music("battle",1.2),this.player.canSling=this.player.canStrike=this.player.canDodge=!0,this.cam.snapBehind(Math.atan2(this.bear.pos.x-this.player.pos.x,this.bear.pos.z-this.player.pos.z),.12),this.ui.objective("רְדֹף אַחֲרֵי הַדֹּב!",'"וְיָצָאתִי אַחֲרָיו" — הַכֵּה אוֹתוֹ בַּקֶּלַע אוֹ בַּמַּקֵּל'),this.ui.hint([ze.run,ze.sling,ze.strike],8),this.setMarker(()=>this.bear.pos.clone().add(new A(0,1.8,0)),"הַדֹּב"),this.showBoss=!0,this.showHealth=!0,this.bearVulnerable=!0,this.bear.hits=0;let n=0,i=!1,s=2.5;this.bearHitCB=()=>{n=.9,this.bossHP=Math.max(.62,1-this.bear.hits*.12)},this.beh=o=>{const a=this.bear.pos.distanceTo(this.player.pos);if(n>0)n-=o,this.bear.stop(o);else if(i)this.bear.face(this.player.pos,o,3),this.bear.stop(o),this.bear.model.lookTarget=this.player.pos,s-=o,a<2.4&&s<0&&this.bear.hits<3&&!this.bear.model.busy&&(s=2.2,this.bearSwipe("swipe",2.6));else{const c=a>42?1.6:a>22?3.8:4.9;(this.bear.moveTo(e,c,o,2.5)||this.bear.hits>=3)&&(i=!0,this.audio.at("bearGrowl",this.bear.pos,1),this.ui.objective("הַכֵּה אֶת הַדֹּב",'"וְהִכִּתִיו" — הוּא נִלְכַּד בַּסְּבַךְ, וְהַשֶּׂה עֲדַיִן בְּפִיו'))}this.bearThreats[0]=this.bear.pos},await this.until(()=>i&&this.bear.hits>=3&&this.bear.pos.distanceTo(this.player.pos)<2.8),this.check()}bearSwipe(t,e,n){const i=t==="swipe"?.46:.5;return this.audio.at("bearGrowl",this.bear.pos,.9,1.1),this.bear.model.play(t,[{t:i,fn:()=>{const s=this.bear.pos.distanceTo(this.player.pos),o=new A(this.player.pos.x-this.bear.pos.x,0,this.player.pos.z-this.bear.pos.z).normalize(),a=new A(Math.sin(this.bear.heading),0,Math.cos(this.bear.heading)),c=o.dot(a)>.2;let l=!1;this.audio.at("whoosh",this.bear.pos,.9,.7),s<e&&c&&(l=this.player.hurt(this.bear.pos)),l&&(this.cam.addShake(1),this.engine.post.grade.uniforms.uRed.value=1),n?.(l)}}]),i}async rescue(){const t=this.flock.lamb;for(;;){this.ui.objective("הַצֵּל אֶת הַשֶּׂה מִפִּיו",'"וְהִצַּלְתִּי מִפִּיו"');let e=!1;this.beh=a=>{this.bear.face(this.player.pos,a,3),this.bear.stop(a);const c=this.bear.pos.distanceTo(this.player.pos);this.ui.prompt(c<3?_r(ze.interact,"חֲטֹף אֶת הַשֶּׂה מִפִּי הַדֹּב"):null),c<3&&this.input.take("interact")&&(e=!0)},await this.until(()=>e),this.check(),this.beh=null,this.ui.prompt(null),this.player.controlEnabled=!1,this.player.aiming=!1,this.player.model.hold="pull",this.bearVulnerable=!1;const n=new A(Math.sin(this.bear.heading),0,Math.cos(this.bear.heading)),i=this.bear.pos.clone().addScaledVector(n,1.45);let s=.15,o=0;if(this.ui.letterbox(!0),this.beh=a=>{o+=a,this.player.moveToward(i,2,a,.1),this.player.faceToward(this.bear.pos,a,12),this.bear.stop(a),this.bear.model.lookTarget=this.player.pos,this.bear.heading+=Math.sin(o*9)*.6*a,s=Math.max(0,s-a*.12),this.input.take("interact")&&(s+=.09,this.audio.sfx("davidEffort",{volume:.6,pitch:.9+Math.random()*.3}),this.cam.addShake(.15)),this.ui.qte("mash",Me(s,0,1),"מְשֹׁךְ אֶת הַשֶּׂה!",ze.interact)},this.cam.playShots([{duration:30,ease:!1,at:(a,c)=>{const l=new A(-n.z,0,n.x),h=this.player.pos.clone().lerp(this.bear.pos,.45);return{pos:h.clone().addScaledVector(l,3.2).add(new A(0,1.1+Math.sin(c*.5)*.1,0)).addScaledVector(n,.4),look:h.clone().add(new A(0,.8,0)),fov:38}}}]),await this.until(()=>s>=1||o>6.5),this.check(),this.beh=null,this.ui.qte(null),s>=1){this.ui.flashQte(!0);const a=t.object.getWorldPosition(new A);this.flock.group.attach(t.object),t.object.position.set(a.x,this.engine.terrain.heightAt(a.x,a.z),a.z),t.object.rotation.set(0,this.player.heading,0),t.setCarried("none");const c=this.player.pos.clone().addScaledVector(n,7).add(new A(2,0,-1));t.goTo(c,2.6),this.lambHome.copy(c),this.bear.model.hold="none",this.player.model.hold="none",this.audio.at("lambBleat",a,1),this.audio.at("bearHurt",this.bear.pos,1),this.ui.verse(..._n("s1_17_35_smote_delivered"),4),this.bossHP=.55,this.cam.skipShots(),await this.wait(.8),this.check();break}else this.player.model.hold="none",this.cam.skipShots(),this.ui.letterbox(!1),this.player.controlEnabled=!0,this.bearVulnerable=!0,this.player.hurt(this.bear.pos),this.cam.addShake(.8),this.engine.post.grade.uniforms.uRed.value=1,this.ui.hint('<span class="h-item">לחץ מהר יותר כדי לחלץ את השה</span>',4),this.player.health<=0&&(this.player.health=this.player.maxHealth),await this.wait(1.5),this.check()}}async rise(){this.cinematic(!0),this.bearVulnerable=!1,this.player.model.lookTarget=this.bear.model.headCenter.getWorldPosition(new A);const t=new A(Math.sin(this.bear.heading),0,Math.cos(this.bear.heading)),e=this.bear.pos.clone().addScaledVector(t,3.2);this.bear.model.hold="rear",this.audio.music("silence",.6);let n=0;this.beh=s=>{n+=s,this.player.moveToward(e,2.4,s,.2),this.player.faceToward(this.bear.pos,s,10),this.bear.face(this.player.pos,s,3),this.bear.stop(s),this.bear.model.roar=n>1&&n<3.6?Math.min(1,(n-1)*2):ue(this.bear.model.roar,0,4,s),n>1&&n<1.05&&(this.audio.at("bearRoar",this.bear.pos,1.2),this.cam.addShake(.9),this.slowMo(.45),this.audio.sfx("heartbeat",{volume:.8})),n>3.6&&this.slowTarget<1&&this.slowMo(1),this.player.model.lookTarget=this.bear.model.headCenter.getWorldPosition(new A)};const i=()=>this.bear.pos;await this.shots([{duration:5.4,at:s=>{const o=i(),a=new A(-t.z,0,t.x);return{pos:o.clone().addScaledVector(t,5.2-s*.8).addScaledVector(a,1.3).add(new A(0,.45,0)),look:o.clone().add(new A(0,1.4+s*.4,0)),fov:42-s*4}}}]),this.check(),this.ui.verse(..._n("s1_17_35_rose"),3.5),this.slowMo(1),this.audio.music("battle",.5)}async fight(){this.cinematic(!1),this.cam.snapBehind(Math.atan2(this.bear.pos.x-this.player.pos.x,this.bear.pos.z-this.player.pos.z),.05),this.player.canSling=this.player.canStrike=this.player.canDodge=!0,this.bearVulnerable=!0,this.ui.objective("עֲמֹד מוּלוֹ","הִתְחַמֵּק מִמַּכּוֹתָיו — וְחַכֵּה לְרֶגַע שֶׁיְּאַבֵּד שִׁוּוּי מִשְׁקָל"),this.ui.hint([ze.dodge,ze.strike],8),this.setMarker(null);let t=0,e=1.8,n=!1,i=0,s=!1,o=0;this.bearHitCB=c=>{c==="staff"&&t++};const a=()=>{o>0&&(t++,o=0,this.ui.flashQte(!0))};this.player.onDodge=a,this.beh=c=>{const l=this.bear.pos.distanceTo(this.player.pos);if(this.bear.model.lookTarget=this.player.pos,o=Math.max(0,o-c),!n)this.bear.face(this.player.pos,c,2.5),l>2.3&&!this.bear.model.busy?this.bear.moveTo(this.player.pos,l>7?3.4:l>4?2.2:1.2,c,2.2):this.bear.stop(c),e-=c,e<0&&l<3.6&&!this.bear.model.busy&&(e=2.3+Math.random()*.9,o=.62,this.ui.qte("press",0,"הִתְחַמֵּק!",ze.dodge),this.bearSwipe("swipeHigh",2.9,h=>{if(this.ui.qte(null),!h&&this.bear.pos.distanceTo(this.player.pos)<4.2){if(o<=0)return;t++,o=0}})),this.player.health<=0&&(this.player.health=this.player.maxHealth,this.ui.verse(..._n("ps_23_1_shepherd"),3),this.player.model.play("hurt"),t=Math.max(0,t-1)),t>=2&&!this.bear.model.busy&&(n=!0,i=0,this.slowMo(.3),this.audio.at("bearHurt",this.bear.pos,1,.8),this.bear.model.play("hurt"));else{i+=c/Math.max(.3,this.timeScale),this.bear.stop(c);const h=l<3.8;this.ui.qte("press",0,h?"תְּפֹס בִּזְקָנוֹ!":"הִתְקָרֵב — וּתְפֹס בִּזְקָנוֹ!",ze.interact),this.input.take("interact")&&h&&(s=!0),i>3.2&&!s&&(n=!1,t=0,e=1.2,this.slowMo(1),this.ui.qte(null))}this.showBoss=!0},await this.until(()=>s),this.check(),this.player.onDodge=void 0,this.ui.qte(null)}async clinch(){this.cinematic(!0),this.slowMo(1),this.player.canSling=!1,this.player.aiming=!1,this.player.model.hold="grab",this.player.model.staffMode="strike",this.bear.model.hold="rear",this.bearVulnerable=!1,this.ui.verse(..._n("s1_17_35_beard"),3.5),this.audio.sfx("grab"),this.audio.at("bearRoar",this.bear.pos,1,1.1);const t=()=>new A(Math.sin(this.bear.heading),0,Math.cos(this.bear.heading));let e=0,n=-.8;const i=1.15;let s=!1;this.beh=h=>{const d=this.bear.pos.clone().addScaledVector(t(),.95);if(this.player.moveToward(d,3,h,.08),this.player.faceToward(this.bear.pos,h,14),this.bear.face(this.player.pos,h,4),this.bear.stop(h),this.bear.model.roar=.25+Math.sin(this.time*7)*.15,this.player.model.lookTarget=this.bear.model.headCenter.getWorldPosition(new A),n+=h,n>=0&&!s){const f=Me(1-n/i,-.3,1);this.ui.qte("timing",Math.max(0,f),"הַכֵּה!",_r(ze.strike,""));const u=this.input.take("strike")||this.input.take("sling");if(u||f<=-.25){s=!0;const m=u&&f<.2&&f>-.25;this.ui.flashQte(m),m?(e++,this.player.model.play("strikeHigh",[{t:.27,fn:()=>{this.audio.at("staffHit",this.bear.pos,1.2),this.audio.at("bearHurt",this.bear.pos,1),this.bear.model.play("hurt"),this.cam.addShake(1.1),this.slowMo(.25),this.after(.38,()=>this.slowMo(1),!0),this.bossHP=Math.max(0,.55-e*.185),this.engine.particles.dustBurst(this.bear.model.headCenter.getWorldPosition(new A),8,.6,new dt(.6,.45,.3))}}])):(this.bear.model.play("hurt"),this.cam.addShake(.4)),this.after(.7,()=>{s=!1,n=-.55},!0)}}};const o=()=>new A(-t().z,0,t().x);this.cam.playShots([{duration:60,ease:!1,at:(h,d)=>{const f=this.player.pos.clone().lerp(this.bear.pos,.5),u=Math.sin(d*.25)*.5,m=o().multiplyScalar(Math.cos(u)*3.4).addScaledVector(t(),Math.sin(u)*3.4+1.2);return{pos:f.clone().add(m).add(new A(0,1,0)),look:f.clone().add(new A(0,1.45,0)),fov:40}}}]),await this.until(()=>e>=3&&!this.player.model.busy),this.check(),this.ui.qte(null),this.beh=null,this.bear.alive=!1,this.bear.model.roar=0,this.bear.model.hold="down",this.player.model.hold="none",this.player.model.staffMode="plant",this.player.model.lookTarget=this.bear.pos.clone().add(new A(0,.3,0)),this.audio.at("bearDeath",this.bear.pos,1.1),this.slowMo(.4),this.ui.verse(..._n("s1_17_35_slew"),5),this.bossHP=0,this.cam.skipShots(),await this.wait(.05);const a=this.bear.pos.clone(),c=this.player.pos.clone(),l=a.clone().lerp(c,.5);await this.shots([rc(5.5,()=>l,5.5,4.2,this.bear.heading+1.9,this.bear.heading+1.2,1.6,2.4,.6,40)]),this.check(),this.slowMo(1),this.engine.particles.dustBurst(a,18,1.2),this.showBoss=!1,this.showHealth=!1,this.audio.music("victory",3),this.audio.ambience(.5,.4,.2)}async aftermath(){const t=this.flock.lamb;this.cinematic(!1),this.player.canSling=this.player.canStrike=this.player.canDodge=!1,this.ui.objective("הָרֵם אֶת הַשֶּׂה","הוּא רוֹעֵד מִפַּחַד — שָׂא אוֹתוֹ עַל כְּתֵפֶיךָ"),this.setMarker(()=>t.position.clone().add(new A(0,1,0)),"הַשֶּׂה");let e=!1;this.beh=()=>{t.state!=="carried"&&t.position.distanceTo(this.player.pos)>6&&Math.random()<.01&&t.goTo(this.lambHome,.6);const n=Math.hypot(t.position.x-this.player.pos.x,t.position.z-this.player.pos.z);this.ui.prompt(n<1.9?_r(ze.interact,"הָרֵם אֶת הַשֶּׂה"):null),n<1.9&&this.input.take("interact")&&(e=!0)},await this.until(()=>e),this.check(),this.ui.prompt(null),this.player.model.play("pick",[{t:.5,fn:()=>{this.player.model.root.updateMatrixWorld(!0),t.object.updateMatrixWorld(!0);const n=t.object.worldToLocal(t.bodyCenter.getWorldPosition(new A));this.player.model.shoulderSocket.add(t.object),t.setCarried("shoulders"),t.object.rotation.set(0,0,0),t.object.position.copy(n.multiplyScalar(-1)),this.player.carrying=!0,this.player.model.hold="carry",this.audio.sfx("lambBleat",{volume:.6})}}]),await this.wait(1),this.check(),this.ui.objective("הָשֵׁב אֶת הַשֶּׂה אֶל הָעֵדֶר"),this.setMarker(()=>this.flockCenter().add(new A(0,1.5,0)),"הָעֵדֶר"),this.beh=null,await this.until(()=>this.player.pos.distanceTo(this.flockCenter())<9),this.check()}async ending(){const t=this.flock.lamb;this.cinematic(!0),this.setMarker(null),this.ui.objective(null);let e=0,n=!1;this.beh=h=>{if(e+=h,this.player.speed=0,e>1.2&&!n){n=!0,t.object.getWorldPosition(new A),this.flock.group.attach(t.object);const d=this.player.forward,f=this.player.pos.clone().addScaledVector(d,1.1);t.object.position.set(f.x,this.engine.terrain.heightAt(f.x,f.z),f.z),t.object.rotation.set(0,this.player.heading,0),t.setCarried("none"),this.player.carrying=!1,this.player.model.hold="none",t.goTo(this.flockCenter(),.7),this.audio.sfx("lambBleat",{volume:.5})}e>3.4&&(this.player.model.hold="thanks")};const i=this.player.pos.clone(),s=this.player.forward,o=()=>{this.engine.sky.setSun(Ni.endElevation,Ni.azimuth,this.engine.scene)};this.after(.6,o);const a=[[4,()=>this.ui.verse(..._n("s1_17_37_delivered_me"),6.5)],[11.5,()=>this.ui.verse(..._n("ps_23_4_rod_staff"),7)]];let c=0;const l=this.beh;this.beh=h=>{for(l?.(h);c<a.length&&e>=a[c][0];)a[c++][1]()},await this.shots([rc(6,()=>i,4.2,3.2,this.player.heading+2.4,this.player.heading+1.4,1.2,1.4,1.3,36),{duration:12,at:h=>({pos:i.clone().addScaledVector(s,5+h*18).add(new A(-3-h*10,2+h*16,0)),look:i.clone().add(new A(0,1.2-h*2,0)),fov:40+h*10})}]),this.check(),this.ui.fade(1,2.5),await this.wait(2.8),this.check(),this.audio.music("title",2),this.ui.endCard(!0,()=>{this.ui.endCard(!1),this.engine.sky.setSun(Ni.elevation,Ni.azimuth,this.engine.scene),this.start(!0)},()=>{this.ui.endCard(!1),this.freeRoam=!0,this.cinematic(!1),this.ui.fade(0,2),this.cam.snapBehind(this.player.heading,.15),this.player.canSling=this.player.canStrike=this.player.canDodge=!0,this.ui.objective("שׁוֹטֵט בְּשָׂדוֹת בֵּית לֶחֶם","הַפֶּרֶק הַבָּא יַגִּיעַ בְּקָרוֹב"),this.audio.music("pastoral",4),this.audio.ambience(.45,.5,.2)}),this.beh=null}update(t){this.timeScale=ue(this.timeScale,this.slowTarget,6,t);const e=t*this.timeScale;if(this.time+=e,this.realTime+=t,this.timers.length){const c=this.timers.filter(l=>l.gen===this.gen&&(l.real?this.realTime:this.time)>=l.at);this.timers=this.timers.filter(l=>l.gen===this.gen&&!c.includes(l));for(const l of c)l.fn()}this.audio.slowMo(Me((1-this.timeScale)*1.4,0,1));const n=this.waits.filter(c=>c.gen===this.gen&&c.until());if(n.length){this.waits=this.waits.filter(c=>!n.includes(c));for(const c of n)c.resolve()}this.beh?.(e);const i=this.markerFn?this.markerFn():this.markerPos;this.ui.marker(this.engine.camera,this.cam.inCinematic?null:i,this.markerLabel),this.ui.crosshair(this.player.aiming&&!this.cam.inCinematic,this.player.power,this.player.aimOnTarget,this.player.aimInRange),this.ui.health(this.showHealth&&!this.cam.inCinematic,this.player.health,this.player.maxHealth),this.ui.boss(this.showBoss,this.bossHP);const s=this.engine.post.grade.uniforms.uRed;s.value=ue(s.value,this.showHealth&&this.player.health===1?.35+Math.sin(this.time*4)*.1:0,3,t),this.engine.post.grade.uniforms.uDesat.value=(1-this.timeScale)*.35,this.player.outOfBounds>0&&!this.cam.inCinematic&&this.ui.hint('<span class="h-item">הַצֹּאן זְקוּקִים לְךָ — חֲזֹר אֶל הַמִּרְעֶה</span>',2);const o=ne.uPushers.value;o[0].set(this.player.pos.x,this.player.pos.y,this.player.pos.z,.7),this.bear.visible?o[1].set(this.bear.pos.x,this.bear.pos.y,this.bear.pos.z,1.3):o[1].set(0,-999,0,0);const a=this.flock.lamb.position;return o[2].set(a.x,a.y,a.z,.4),e}get threats(){return this.bear.visible&&this.bear.alive&&this.bear.model.hold!=="carry"?[this.bear.pos]:this.bear.visible&&this.bear.alive?[this.bear.pos]:[]}get lamb(){return this.flock.lamb}}const Pi=new URLSearchParams(location.search),yr=document.getElementById("app"),Mr=Pi.get("test")==="1",Oy={"desktop-high":"גבוהה","desktop-medium":"בינונית","mobile-high":"גבוהה (נייד)","mobile-low":"חסכונית (נייד)"};function Hy(r){const t=document.createElement("div");t.style.cssText="position:fixed;inset:0;z-index:200;display:none;place-items:center;background:#0b0806;color:#f4ead4;font:500 17px Heebo,system-ui,sans-serif;text-align:center;direction:rtl;pointer-events:auto";const e=document.createElement("div"),n=document.createElement("button");n.textContent="טעינה מחדש",n.style.cssText="display:none;margin:18px auto 0;padding:10px 26px;border-radius:24px;border:1.5px solid rgba(232,199,126,.7);background:rgba(20,14,8,.6);color:#f7e3b0;font:600 16px Heebo,system-ui,sans-serif",n.addEventListener("click",()=>location.reload());const i=document.createElement("div");i.append(e,n),t.append(i),r.appendChild(t);let s=0;return{lost(){e.textContent="התמונה נטענת מחדש…",n.style.display="none",t.style.display="grid",clearTimeout(s),s=window.setTimeout(()=>{e.textContent="הגרפיקה של המכשיר אותחלה. הקש כדי לטעון את המשחק מחדש.",n.style.display="block"},4e3)},restored(){clearTimeout(s),t.style.display="none"},fatal(o){clearTimeout(s),e.textContent=o,n.style.display="block",t.style.display="grid"}}}async function Vy(){yr.dir="rtl",yr.lang="he";const r=new Xx(yr),t=new Yx(r.renderer.domElement,yr),e=new Zx(yr,t.isTouch);t.setTouchVisible(!1),window.__engine=r;const n=Hy(document.body);let i=!1,s=!1,o=!1;r.onContextLost=()=>{i=s,o&&T(!0),n.lost()},r.onContextRestored=()=>{n.restored(),o&&!i&&T(!1)},await r.build((V,O)=>e.setLoading(V,O));const a=r.terrain,c=(V,O)=>a.heightAt(V,O),l=new ll(c);r.scene.add(l.group);const h=new zy(r.camera),d=new q_(a,r.tex,r.colliders);r.scene.add(d.group),e.setLoading(.96,"מכין את הצאן…"),await Pu.preloadAsync(7);const f=r.quality.name,u=new Pu({sheep:f==="low"?8:f==="medium"?12:15,rams:f==="low"?1:2,goats:f==="low"?4:f==="medium"?6:8,ground:c,pastureCenter:new A(Xt.pasture.x,c(Xt.pasture.x,Xt.pasture.z),Xt.pasture.z),pastureRadius:Xt.pasture.r,seed:7,walkable:(V,O)=>a.slopeAt(V,O)<.5&&r.colliders.free(V,O,.3)});r.scene.add(u.group),u.onSound=(V,O,P)=>h.at(V,O,P*.8,1,70);const m=new I_(r,l,h),v=new H_(a,r.colliders,r.scene),p=new X_(r.camera,c),g=new By(r,e,t,h,p,m,u,v,d,l),x=Pi.get("jump");(x==="sling"||x==="bear"||x==="fight"||x==="end")&&(g.jump=x),m.place(Xt.start.x+.2,Xt.start.z+2.3,.46),p.playShots([{duration:1e6,ease:!1,at:(V,O)=>({pos:new A(620-O*3,140,230),look:new A(-100,30,-150),fov:42})}]),e.setLoading(.98,"מכוונן את התמונה למכשיר…"),r.setFov(42);const _=Xt.start.x,y=Xt.start.z,w=await r.warmup({bench:!Mr&&Pi.get("bench")!=="0",precompile:!Mr||Pi.get("precompile")==="1",views:[{pos:new A(_-3,c(_-3,y-5)+2.2,y-5),look:new A(Xt.pasture.x,c(Xt.pasture.x,Xt.pasture.z)+1,Xt.pasture.z)},{pos:new A(620,140,230),look:new A(-100,30,-150)}]});window.__bench=w,e.setLoading(1,"מוכן");const T=V=>{o&&(s=V,e.pause(V),t.enabled=!V,V&&document.pointerLockElement&&document.exitPointerLock())};e.onResume=()=>{T(!1),t.isTouch||r.renderer.domElement.requestPointerLock?.()},e.onRestart=()=>{T(!1),r.sky.setSun(Ni.elevation,Ni.azimuth,r.scene),g.start(!0)},e.onVolume=V=>h.setVolume(V),e.onSensitivity=V=>p.sensitivity=.0024*V,document.addEventListener("pointerlockchange",()=>{!document.pointerLockElement&&o&&!s&&!p.inCinematic&&!t.isTouch&&T(!0)}),document.addEventListener("visibilitychange",()=>{document.hidden&&o&&!p.inCinematic&&T(!0)});const R=document.createElement("button");R.className="pause-btn",R.textContent="☰",R.addEventListener("click",V=>{V.stopPropagation(),T(!s)}),e.root.appendChild(R),e.showStart(Oy[r.quality.tier],async()=>{try{await h.init(),h.setVolume(.9)}catch(V){console.warn("audio init failed",V)}o=!0,g.start(Pi.get("skip")==="1")});let E=0,D=0;const M=(V,O=!0)=>{if(t.update(),o&&t.take("pause")&&!p.inCinematic&&T(!s),s){t.clearEdges(),O&&D++%12===0&&r.render(V,0);return}D=0;const P=o?g.update(V):V;if(E+=P,!p.inCinematic&&o){const B=t.consumeLook();p.applyLook(B.x,B.y)}else t.consumeLook();m.update(P,t,p,E),u.update(P,E,{shepherd:m.pos,threats:g.threats,camera:r.camera}),v.update(P),l.update(P),d.update(P),p.target.set(m.pos.x,m.pos.y+1.55,m.pos.z),p.update(V,E),r.setFov(p.fov),r.focus.copy(p.inCinematic?r.camera.position.clone().add(r.camera.getWorldDirection(new A).multiplyScalar(18)):m.pos),h.update(V),O?r.render(V,P):r.tickEnvironment(P),t.clearEdges()},S=Mr||Pi.has("watchdog")?new jx(r.renderer,Mr?1:30):null;window.__watchdog=S;let k=0;const N=(V,O=!0)=>{try{M(V,O),O&&S&&S.afterFrame()&&console.warn("[watchdog]",JSON.stringify(S.events[S.events.length-1]))}catch(P){console.error(P),++k>30&&n.fatal("אירעה תקלה בגרפיקה. הקש כדי לטעון את המשחק מחדש.")}};let z=performance.now();const H=r.quality.mobile&&Pi.get("fps")!=="max"?1e3/60-2.5:0,L=()=>{requestAnimationFrame(L);const V=performance.now();if(V-z<H)return;const O=(V-z)/1e3,P=Math.min(.05,Math.max(1e-4,O));z=V,N(P),r.perfTick(O,o&&!s&&!document.hidden)};if(!Mr)L();else{const V=window;V.__frame=(O,P)=>N(O,P),V.__step=(O,P=1/30)=>{const B=Math.round(O/P);for(let Q=0;Q<B;Q++)M(P,!1);N(P,!0);const G=r.renderer.getContext();G.readPixels(0,0,1,1,G.RGBA,G.UNSIGNED_BYTE,new Uint8Array(4))},V.__frames=(O,P=1/30)=>{for(let B=0;B<O;B++)N(P,!0);return S?.stats()},V.__start=()=>{e.dismissLoading(),o=!0,g.start(Pi.get("skip")==="1")},N(1/30,!0)}window.__game={engine:r,story:g,player:m,bear:v,flock:u,cam:p,ui:e,input:t},window.__ready=!0}Vy().catch(r=>{console.error(r),window.__error=String(r?.stack||r);const t=document.createElement("div");t.style.cssText="position:fixed;inset:0;display:grid;place-items:center;color:#f99;font:14px monospace;padding:24px;white-space:pre-wrap;background:#0b0806",t.textContent=`שגיאה בטעינת המשחק:
`+String(r?.message||r),document.body.appendChild(t)});
