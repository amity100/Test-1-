import { Camera, Vector3 } from 'three';
export class CameraRig { constructor(private camera:Camera){} update(points:Vector3[]){ const c=points.reduce((a,p)=>a.add(p),new Vector3()).multiplyScalar(1/points.length); this.camera.position.lerp(new Vector3(c.x,2.8,7.2),.04); this.camera.lookAt(c.x,1,c.z);} }
