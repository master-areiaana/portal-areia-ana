(function(){
// Layout v4: só desenho. Login, sessão, permissões e links continuam no portal.js.

// Tema: o portal.js segue usando body.light-mode e a chave portalTheme;
// aqui só espelhamos esse estado em <html data-theme>, que é o que o padrão v4 lê.
function espelharTema(){document.documentElement.setAttribute('data-theme',document.body.classList.contains('light-mode')?'light':'dark');}
espelharTema();
new MutationObserver(espelharTema).observe(document.body,{attributes:true,attributeFilter:['class']});
})();
