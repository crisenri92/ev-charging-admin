'use client'
import{useEffect,useState}from 'react'
import{supabase}from '@/lib/supabase'
type P={id:string;email:string;full_name?:string;phone?:string;role?:string;created_at?:string}
export default function UsersPage(){
const[users,setUsers]=useState<P[]>([])
const[loading,setLoading]=useState(true)
const[show,setShow]=useState(false)
const[form,setForm]=useState({email:'',full_name:'',phone:'',role:'user'})
const[saving,setSaving]=useState(false)
const[err,setErr]=useState<string|null>(null)
async function load(){setLoading(true);const{data}=await supabase.from('profiles').select('*').order('created_at',{ascending:false});setUsers(data||[]);setLoading(false)}
useEffect(()=>{load()},[])
async function create(e:React.FormEvent){e.preventDefault();if(!form.email)return;setSaving(true);const{error}=await supabase.from('profiles').insert([{email:form.email,full_name:form.full_name||null,phone:form.phone||null,role:form.role,created_at:new Date().toISOString()}]);setSaving(false);if(error){setErr(error.message);return};setShow(false);load()}
return(<div className="p-6"><div className="flex justify-between items-center mb-6"><h1 className="text-2xl font-bold">Usuarios</h1><button onClick={()=>setShow(true)} className="bg-blue-600 text-white px-4 py-2 rounded-lg">+ Crear usuario</button></div>
{show&&<div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"><div className="bg-white rounded-xl p-6 w-96"><h2 className="font-bold mb-4">Nuevo usuario</h2><form onSubmit={create} className="space-y-3"><input type="email" placeholder="Email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} className="w-full border rounded px-3 py-2 text-sm" required/><input placeholder="Nombre" value={form.full_name} onChange={e=>setForm({...form,full_name:e.target.value})} className="w-full border rounded px-3 py-2 text-sm"/><select value={form.role} onChange={e=>setForm({...form,role:e.target.value})} className="w-full border rounded px-3 py-2 text-sm"><option value="user">Usuario</option><option value="admin">Admin</option></select>{err&&<p className="text-red-600 text-sm">{err}</p>}<div className="flex gap-2"><button type="button" onClick={()=>setShow(false)} className="flex-1 border rounded py-2 text-sm">Cancelar</button><button type="submit" disabled={saving} className="flex-1 bg-blue-600 text-white rounded py-2 text-sm">{saving?'...':'Crear'}</button></div></form></div></div>}
<div className="bg-white shadow rounded overflow-hidden"><table className="min-w-full divide-y divide-gray-200"><thead className="bg-gray-50"><tr><th className="px-4 py-3 text-left text-xs text-gray-500">Email</th><th className="px-4 py-3 text-left text-xs text-gray-500">Nombre</th><th className="px-4 py-3 text-left text-xs text-gray-500">Rol</th></tr></thead><tbody>{users.map(u=><tr key={u.id} className="border-t"><td className="px-4 py-3 text-sm">{u.email}</td><td className="px-4 py-3 text-sm">{u.full_name||'-'}</td><td className="px-4 py-3 text-sm">{u.role}</td></tr>)}</tbody></table></div>
</div>)}