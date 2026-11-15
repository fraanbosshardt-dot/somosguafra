// Código fijo compartido entre el HTML y su hash de CSP; nunca contiene datos del usuario.
export const PREFERENCE_SCRIPT = 'try{var d=document.documentElement;if(localStorage.getItem("somosguafra-big")==="1")d.setAttribute("data-big","");var t=localStorage.getItem("somosguafra-theme");if(t==="light"||t==="dark")d.setAttribute("data-theme",t)}catch(e){}';
