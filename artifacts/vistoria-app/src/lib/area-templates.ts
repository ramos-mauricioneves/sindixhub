export type AreaTemplate = {
  labelKey: string;
  nome: string;
  tipo: string;
  privacidade: "publica" | "privada" | "mista";
  tecnico: boolean;
};

export type AreaCategory = {
  key: string;
  templates: AreaTemplate[];
};

export const AREA_CATEGORIES: AreaCategory[] = [
  {
    key: "lazer",
    templates: [
      { labelKey: "condominios.templates.piscina", nome: "Piscina", tipo: "lazer", privacidade: "publica", tecnico: false },
      { labelKey: "condominios.templates.academia", nome: "Academia", tipo: "lazer", privacidade: "publica", tecnico: false },
      { labelKey: "condominios.templates.salaoFestas", nome: "Salão de Festas", tipo: "social", privacidade: "publica", tecnico: false },
      { labelKey: "condominios.templates.playground", nome: "Playground", tipo: "infantil", privacidade: "publica", tecnico: false },
      { labelKey: "condominios.templates.churrasqueira", nome: "Churrasqueira", tipo: "lazer", privacidade: "publica", tecnico: false },
      { labelKey: "condominios.templates.lounge", nome: "Lounge", tipo: "social", privacidade: "publica", tecnico: false },
      { labelKey: "condominios.templates.espacoGourmet", nome: "Espaço Gourmet", tipo: "social", privacidade: "publica", tecnico: false },
      { labelKey: "condominios.templates.quadraEsportiva", nome: "Quadra Esportiva", tipo: "esportiva", privacidade: "publica", tecnico: false },
      { labelKey: "condominios.templates.sauna", nome: "Sauna", tipo: "lazer", privacidade: "publica", tecnico: false },
      { labelKey: "condominios.templates.brinquedoteca", nome: "Brinquedoteca", tipo: "infantil", privacidade: "publica", tecnico: false },
    ],
  },
  {
    key: "circulacao",
    templates: [
      { labelKey: "condominios.templates.corredor", nome: "Corredor", tipo: "circulacao", privacidade: "publica", tecnico: false },
      { labelKey: "condominios.templates.hallEntrada", nome: "Hall de Entrada", tipo: "circulacao", privacidade: "publica", tecnico: false },
      { labelKey: "condominios.templates.elevadorSocial", nome: "Elevador Social", tipo: "circulacao", privacidade: "publica", tecnico: false },
      { labelKey: "condominios.templates.elevadorServico", nome: "Elevador de Serviço", tipo: "circulacao", privacidade: "publica", tecnico: false },
      { labelKey: "condominios.templates.escada", nome: "Escada", tipo: "circulacao", privacidade: "publica", tecnico: false },
      { labelKey: "condominios.templates.corredorServico", nome: "Corredor de Serviço", tipo: "circulacao", privacidade: "publica", tecnico: false },
    ],
  },
  {
    key: "garagem",
    templates: [
      { labelKey: "condominios.templates.garagem", nome: "Garagem", tipo: "estacionamento", privacidade: "privada", tecnico: false },
      { labelKey: "condominios.templates.vagaVisitante", nome: "Vaga de Visitante", tipo: "estacionamento", privacidade: "publica", tecnico: false },
      { labelKey: "condominios.templates.bicicletario", nome: "Bicicletário", tipo: "estacionamento", privacidade: "publica", tecnico: false },
      { labelKey: "condominios.templates.lavagemVeiculos", nome: "Lavagem de Veículos", tipo: "servico", privacidade: "publica", tecnico: false },
    ],
  },
  {
    key: "servicos",
    templates: [
      { labelKey: "condominios.templates.portaria", nome: "Portaria", tipo: "administrativa", privacidade: "publica", tecnico: false },
      { labelKey: "condominios.templates.salaoCorrespondencias", nome: "Salão de Correspondências", tipo: "comum", privacidade: "publica", tecnico: false },
      { labelKey: "condominios.templates.deposito", nome: "Depósito", tipo: "servico", privacidade: "privada", tecnico: true },
      { labelKey: "condominios.templates.lixeira", nome: "Lixeira", tipo: "servico", privacidade: "publica", tecnico: false },
      { labelKey: "condominios.templates.salaZeladora", nome: "Sala da Zeladora", tipo: "servico", privacidade: "privada", tecnico: true },
      { labelKey: "condominios.templates.administracao", nome: "Administração", tipo: "administrativa", privacidade: "privada", tecnico: true },
    ],
  },
  {
    key: "manutencao",
    templates: [
      { labelKey: "condominios.templates.cisterna", nome: "Cisterna", tipo: "manutencao", privacidade: "privada", tecnico: true },
      { labelKey: "condominios.templates.caixaDagua", nome: "Caixa d'Água", tipo: "manutencao", privacidade: "privada", tecnico: true },
      { labelKey: "condominios.templates.casaMaquinas", nome: "Casa de Máquinas", tipo: "predial", privacidade: "privada", tecnico: true },
      { labelKey: "condominios.templates.gerador", nome: "Gerador", tipo: "manutencao", privacidade: "privada", tecnico: true },
      { labelKey: "condominios.templates.subestacaoEletrica", nome: "Subestação Elétrica", tipo: "manutencao", privacidade: "privada", tecnico: true },
      { labelKey: "condominios.templates.centralGas", nome: "Central de Gás", tipo: "manutencao", privacidade: "privada", tecnico: true },
      { labelKey: "condominios.templates.barrilete", nome: "Barrilete", tipo: "predial", privacidade: "privada", tecnico: true },
    ],
  },
  {
    key: "unidades",
    templates: [
      { labelKey: "condominios.templates.apartamento", nome: "Apartamento", tipo: "unidade_privativa", privacidade: "privada", tecnico: false },
      { labelKey: "condominios.templates.cobertura", nome: "Cobertura", tipo: "unidade_privativa", privacidade: "privada", tecnico: false },
      { labelKey: "condominios.templates.studio", nome: "Studio", tipo: "unidade_privativa", privacidade: "privada", tecnico: false },
      { labelKey: "condominios.templates.loja", nome: "Loja", tipo: "unidade_privativa", privacidade: "privada", tecnico: false },
    ],
  },
];

export const KNOWN_AREA_TIPOS = new Set([
  "comum", "lazer", "esportiva", "social", "servico",
  "estacionamento", "infantil", "predial", "administrativa",
  "manutencao", "circulacao", "unidade_privativa",
]);
