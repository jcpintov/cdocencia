// El perfil procede de una lectura server-side; nunca de parámetros o user_metadata.
export function esSuperadmin(perfil,identidad){
 return perfil?.es_admin===true&&perfil.cuenta_eliminada!==true&&
  (perfil.rol==='SUPERADMIN'||perfil.rol===undefined)&&
  (String(identidad?.email||'').toLowerCase()==='jpintov@gmail.com'||identidad?.app_metadata?.superadmin_principal===true)&&
  String(perfil.email||'').toLowerCase()===String(identidad?.email||'').toLowerCase();
}
export function esOperador(perfil,identidad){
 return esSuperadmin(perfil,identidad)||(
  perfil?.es_admin===true&&perfil.rol==='ADMIN'&&perfil.cuenta_eliminada!==true&&
  !!identidad?.id&&String(perfil.email||'').toLowerCase()===String(identidad.email||'').toLowerCase()
 );
}
