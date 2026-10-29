#!/usr/bin/env python3
"""Create editable five-page draw.io XML plus self-contained SVG exports."""
from pathlib import Path
import xml.etree.ElementTree as ET
from html import escape
from datetime import datetime, timezone
ROOT=Path(__file__).resolve().parents[1]/'docs'/'diagrams'
SVG=ROOT/'svg'
SVG.mkdir(parents=True,exist_ok=True)
BG='#f7faf9'; BORDER='#b7d5cf'; DARK='#123e43'; ACCENT='#087a71'

def node(id,label,x,y,w=185,h=72,color='#e6f4ef',kind='round'):
    return dict(id=id,label=label,x=x,y=y,w=w,h=h,color=color,kind=kind)
def edge(a,b,label=''):
    return (a,b,label)

def diagrams():
 return [
  ('Layered Architecture',[
    node('client','Browser UI\nHTML · CSS · JS',425,70,245,65,'#deecfc'),
    node('routes','Routes\nREST · GraphQL · Socket.IO',425,180,245,70),
    node('controllers','Controllers\nHTTP response / orchestration',425,295,245,70),
    node('services','Services\nClaims · Matching · Notifications',425,410,245,70),
    node('models','Models\nMongoose document schemas',425,525,245,70),
    node('mongo','MongoDB 7',790,527,210,65,'#fff4df'),
    node('security','Cross-cutting middleware\nJWT · RBAC · Validation\nCSRF · Rate Limits · CSP',85,284,245,110,'#f9e8e8'),
  ],[edge('client','routes','HTTP / WS'),edge('routes','controllers'),edge('controllers','services'),edge('services','models'),edge('models','mongo'),edge('security','routes','guard')]),
  ('C4 Context and Container',[
    node('student','Students / Faculty / Staff\nReport · Search · Claim',60,130,260,95,'#e9edfe'),
    node('staff','Campus security / Admin\nReview · Resolve · Manage',60,390,260,95,'#fef0da'),
    node('browser','CampusFinder Web UI\nVanilla JS browser client',425,120,270,85,'#d8f4e9'),
    node('server','CampusFinder Application\nExpress 5 API + Apollo + Socket.IO',425,365,270,95,'#d8f4e9'),
    node('database','MongoDB 7 Database\nUsers · Items · Claims · Alerts',810,365,250,95,'#ffefda')
  ],[edge('student','browser','Uses'),edge('staff','browser','Uses'),edge('browser','server','HTTPS / WebSocket'),edge('server','database','Mongoose / TCP')]),
  ('ER Data Model',[
    node('User','User\n_id, name, email, role',65,200,220,105,'#deecfc'),
    node('Item','Item\n_id, reporter, type, status, category',420,68,280,102,'#e4f4ea'),
    node('Claim','Claim\n_id, item, claimant, proofText, decidedBy',420,252,280,108,'#e4f4ea'),
    node('Notification','Notification\n_id, user, itemId, type, read',420,446,280,108,'#e4f4ea'),
    node('RefreshToken','RefreshToken\n_id, user, tokenHash, expiresAt',785,190,255,105,'#fff0df')
  ],[edge('User','Item','1:N reporter'),edge('User','Claim','1:N claimant'),edge('Item','Claim','1:N item'),edge('User','Notification','1:N user'),edge('Item','Notification','1:N itemId'),edge('User','RefreshToken','1:N user')]),
  ('Claim Sequence',[
    node('claimant','Claimant\nBrowser B',70,60,170,67,'#deecfc'),
    node('server','Express Service\nREST + Socket.IO',327,60,210,67,'#dff5ed'),
    node('database','MongoDB\nClaims / Items',627,60,185,67,'#fff1dc'),
    node('owner','Reporter\nBrowser A',895,60,170,67,'#deecfc'),
    node('step1','1. POST /items/:id/claims\nProof of ownership',70,198,240,75),
    node('step2','2. Save pending claim;\nItem → claim_pending',362,272,230,75),
    node('step3','3. claim:new private alert\nto owner & moderators',771,361,290,75),
    node('step4','4. Owner approves/rejects\nPATCH /claims/:id',771,460,290,75),
    node('step5','5. Mark claim and item;\nnotify claimant live',362,552,250,75),
  ],[edge('claimant','server','Submits proof'),edge('server','database','Persists'),edge('server','owner','Private event'),edge('step1','step2'),edge('step2','step3'),edge('step3','step4'),edge('step4','step5')]),
  ('Deployment View',[
    node('browser','Campus Browser\nLaptop / Mobile browser',65,182,260,115,'#deecfc'),
    node('node','Node.js 22 Runtime\nExpress 5 · GraphQL · Socket.IO\nSingle-process deployment',422,161,320,150,'#dff5ed'),
    node('db','MongoDB 7\nLocal service / Docker container',820,182,245,115,'#fff0df'),
    node('trust','Trust boundary\nBrowser network ⇆ Node process\nTLS termination required in production',330,405,460,100,'#fae9e3'),
    node('risk','Single points of failure\nNode.js process + database\nLocal lab demo only',330,550,460,85,'#faf1e0'),
  ],[edge('browser','node','HTTP + Socket.IO'),edge('node','db','Mongoose driver'),edge('node','trust','Boundary'),edge('trust','risk','Availability')]),
 ]

mxfile=ET.Element('mxfile',{'host':'app.diagrams.net','modified':datetime.now(timezone.utc).isoformat(),'agent':'CampusFinder','version':'24.7.17','type':'device'})
for index,(title,nodes,edges) in enumerate(diagrams(),1):
 diagram=ET.SubElement(mxfile,'diagram',{'id':f'campusfinder-{index}','name':title})
 model=ET.SubElement(diagram,'mxGraphModel',{'dx':'1400','dy':'900','grid':'1','gridSize':'10','guides':'1','tooltips':'1','connect':'1','arrows':'1','fold':'1','page':'1','pageScale':'1','pageWidth':'1120','pageHeight':'700','math':'0','shadow':'0'})
 root=ET.SubElement(model,'root')
 ET.SubElement(root,'mxCell',{'id':'0'})
 ET.SubElement(root,'mxCell',{'id':'1','parent':'0'})
 for n in nodes:
  style=f'rounded=1;whiteSpace=wrap;html=1;fillColor={n["color"]};strokeColor={BORDER};fontColor={DARK};fontFamily=Helvetica;fontSize=15;fontStyle=1;spacing=8;'
  cell=ET.SubElement(root,'mxCell',{'id':n['id'],'value':n['label'].replace('\n','<br>'),'style':style,'vertex':'1','parent':'1'})
  ET.SubElement(cell,'mxGeometry',{'x':str(n['x']),'y':str(n['y']),'width':str(n['w']),'height':str(n['h']),'as':'geometry'})
 for j,(source,target,label) in enumerate(edges):
  cell=ET.SubElement(root,'mxCell',{'id':f'e{j}','value':label,'style':'edgeStyle=orthogonalEdgeStyle;rounded=1;html=1;endArrow=block;endFill=1;strokeColor=#178e84;strokeWidth=2;fontSize=11;fontColor=#45776f;','edge':'1','parent':'1','source':source,'target':target})
  ET.SubElement(cell,'mxGeometry',{'relative':'1','as':'geometry'})
 # SVG independent export with simple x/y links and properly escaped text
 positions={n['id']:n for n in nodes}
 parts=[f'<svg xmlns="http://www.w3.org/2000/svg" width="1120" height="700" viewBox="0 0 1120 700">',
 '<defs><marker id="arrow" markerWidth="9" markerHeight="9" refX="8" refY="4.5" orient="auto"><path d="M0,0 L9,4.5 L0,9 Z" fill="#178e84"/></marker></defs>',
 '<rect x="0" y="0" width="1120" height="700" fill="#f7faf9"/>',
 f'<text x="40" y="41" font-family="Arial,sans-serif" font-size="22" font-weight="700" fill="{DARK}">{escape(title)}</text>']
 for source,target,label in edges:
  a,b=positions[source],positions[target]
  ax=a['x']+a['w']/2; ay=a['y']+a['h']/2; bx=b['x']+b['w']/2; by=b['y']+b['h']/2
  dx=bx-ax;dy=by-ay
  if abs(dx)>abs(dy):
   ax=a['x']+(a['w'] if dx>0 else 0);bx=b['x']+(0 if dx>0 else b['w'])
  else:
   ay=a['y']+(a['h'] if dy>0 else 0);by=b['y']+(0 if dy>0 else b['h'])
  parts.append(f'<path d="M{ax:.1f} {ay:.1f} L{bx:.1f} {by:.1f}" stroke="#178e84" stroke-width="2" fill="none" marker-end="url(#arrow)"/>')
  if label:
   midx=(ax+bx)/2;midy=(ay+by)/2-8
   parts.append(f'<text x="{midx:.1f}" y="{midy:.1f}" text-anchor="middle" font-size="10" font-family="Arial" fill="#477d70">{escape(label)}</text>')
 for n in nodes:
  parts.append(f'<rect x="{n["x"]}" y="{n["y"]}" width="{n["w"]}" height="{n["h"]}" rx="11" fill="{n["color"]}" stroke="{BORDER}" stroke-width="2"/>')
  lines=n['label'].split('\n')
  st=n['y']+n['h']/2-((len(lines)-1)*10)
  for li,line in enumerate(lines):
   parts.append(f'<text x="{n["x"]+n["w"]/2}" y="{st+li*19:.1f}" text-anchor="middle" font-size="13" font-weight="{700 if li==0 else 400}" fill="{DARK}" font-family="Arial,sans-serif">{escape(line)}</text>')
 parts.append('</svg>')
 out=SVG/(title.lower().replace(' ','-')+'.svg')
 out.write_text('\n'.join(parts),encoding='utf-8')
ET.ElementTree(mxfile).write(ROOT/'CampusFinder.drawio',encoding='utf-8',xml_declaration=True)
print('Generated 5 SVG diagrams and CampusFinder.drawio')
