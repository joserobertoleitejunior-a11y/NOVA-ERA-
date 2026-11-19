# NOVA ERA — App de check-in de carga/descarga
PWA para funcionários (check-in com fotos + localização) e painel admin. Stack: HTML/JS puro + Supabase + Netlify. Padrões: `PADROES-AGENCIA.md`. Preparação da reunião: `BRIEFING-NOVA-ERA.md`.

## Rodar local
`python3 -m http.server 8080` → http://localhost:8080 (câmera/GPS exigem HTTPS ou localhost).

## Criar o 1º admin
1. Supabase → Authentication → Add user (e-mail + senha).
2. SQL Editor: `insert into perfis (id, nome, papel) values ('<uuid do usuário>', 'Nome', 'admin');`
Funcionários: mesmo processo com `papel = 'funcionario'` (tela de cadastro no admin = próxima etapa).

## Segurança
Só a chave pública está no front; tudo protegido por RLS; fotos em bucket privado com URL assinada (5 min).
