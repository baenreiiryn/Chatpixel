# Características, rolagens e retomada do Mestre

O contexto enviado ao Mestre inclui as descrições e regras das características
e cartas que constam na ficha, com seus trackers associados. Falar para inspirar
ou encorajar o grupo aponta Inspiração como candidata quando o personagem possui
Rally. A indicação não ativa a habilidade sozinha: o Mestre avalia a intenção,
os limites e a disponibilidade, e registra os efeitos pelas ferramentas.

O executor de turnos registra o texto que estava sendo resolvido e as ferramentas
já aplicadas. Se a chamada seguinte falhar, a retomada preserva o estado e os
resultados. Chamadas equivalentes às já executadas reutilizam o resultado salvo
na nova tentativa, em vez de cobrar novamente o mesmo custo.

Pedidos de rolagem continuam disponíveis ao retomar. Uma resposta que pede dados
somente no texto passa por uma etapa que exige request_player_roll antes da
publicação. Se o modelo insistir em ignorar a ferramenta, o executor informa o
erro e preserva o progresso em vez de apresentar um pedido sem vínculo mecânico.

Ao terminar a animação dos dados, o resultado vinculado é salvo e enviado
automaticamente ao Mestre. Se a continuação falhar ou estiver sem conexão, o
botão Retomar resposta do Mestre utiliza o resultado existente, inclusive depois
de recarregar a página. Não é necessário rolar novamente.

Turnos antigos sem registro de retomada usam a recuperação conservadora:
podem consultar memória e solicitar dados sem repetir alterações persistentes.

Validação: testes do executor com falhas de rede simuladas, verificação de
tipos e compilação. A verificação do navegador usa um serviço simulado para
percorrer a interface real em 390×844: ativação de Inspiração, falha antes do
pedido de dados, pedido textual corrigido, continuação automática e recuperação
após recarregar a página, sem repetir custos nem rolagens.
