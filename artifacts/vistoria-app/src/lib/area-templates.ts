export type AreaTemplate = {
  nome: string;
  tipo: string;
  privacidade: "publica" | "privada" | "mista";
};

export type AreaCategory = {
  key: string;
  templates: AreaTemplate[];
};

export const AREA_CATEGORIES: AreaCategory[] = [
  {
    key: "lazer",
    templates: [
      { nome: "Piscina", tipo: "lazer", privacidade: "publica" },
      { nome: "Academia", tipo: "lazer", privacidade: "publica" },
      { nome: "Salão de Festas", tipo: "social", privacidade: "publica" },
      { nome: "Playground", tipo: "infantil", privacidade: "publica" },
      { nome: "Churrasqueira", tipo: "lazer", privacidade: "publica" },
      { nome: "Lounge", tipo: "social", privacidade: "publica" },
      { nome: "Espaço Gourmet", tipo: "social", privacidade: "publica" },
      { nome: "Quadra Esportiva", tipo: "esportiva", privacidade: "publica" },
      { nome: "Sauna", tipo: "lazer", privacidade: "publica" },
      { nome: "Brinquedoteca", tipo: "infantil", privacidade: "publica" },
    ],
  },
  {
    key: "circulacao",
    templates: [
      { nome: "Corredor", tipo: "circulacao", privacidade: "publica" },
      { nome: "Hall de Entrada", tipo: "circulacao", privacidade: "publica" },
      { nome: "Elevador Social", tipo: "circulacao", privacidade: "publica" },
      { nome: "Elevador de Serviço", tipo: "circulacao", privacidade: "publica" },
      { nome: "Escada", tipo: "circulacao", privacidade: "publica" },
      { nome: "Corredor de Serviço", tipo: "circulacao", privacidade: "publica" },
    ],
  },
  {
    key: "garagem",
    templates: [
      { nome: "Garagem", tipo: "estacionamento", privacidade: "privada" },
      { nome: "Vaga de Visitante", tipo: "estacionamento", privacidade: "publica" },
      { nome: "Bicicletário", tipo: "estacionamento", privacidade: "publica" },
      { nome: "Lavagem de Veículos", tipo: "servico", privacidade: "publica" },
    ],
  },
  {
    key: "servicos",
    templates: [
      { nome: "Portaria", tipo: "administrativa", privacidade: "publica" },
      { nome: "Salão de Correspondências", tipo: "comum", privacidade: "publica" },
      { nome: "Depósito", tipo: "servico", privacidade: "privada" },
      { nome: "Lixeira", tipo: "servico", privacidade: "publica" },
      { nome: "Sala da Zeladora", tipo: "servico", privacidade: "privada" },
      { nome: "Administração", tipo: "administrativa", privacidade: "privada" },
    ],
  },
  {
    key: "manutencao",
    templates: [
      { nome: "Cisterna", tipo: "manutencao", privacidade: "privada" },
      { nome: "Caixa d'Água", tipo: "manutencao", privacidade: "privada" },
      { nome: "Casa de Máquinas", tipo: "predial", privacidade: "privada" },
      { nome: "Gerador", tipo: "manutencao", privacidade: "privada" },
      { nome: "Subestação Elétrica", tipo: "manutencao", privacidade: "privada" },
      { nome: "Central de Gás", tipo: "manutencao", privacidade: "privada" },
      { nome: "Barrilete", tipo: "predial", privacidade: "privada" },
    ],
  },
  {
    key: "unidades",
    templates: [
      { nome: "Apartamento", tipo: "unidade_privativa", privacidade: "privada" },
      { nome: "Cobertura", tipo: "unidade_privativa", privacidade: "privada" },
      { nome: "Studio", tipo: "unidade_privativa", privacidade: "privada" },
      { nome: "Loja", tipo: "unidade_privativa", privacidade: "privada" },
    ],
  },
];

export const KNOWN_AREA_TIPOS = new Set([
  "comum", "lazer", "esportiva", "social", "servico",
  "estacionamento", "infantil", "predial", "administrativa",
  "manutencao", "circulacao",
]);
