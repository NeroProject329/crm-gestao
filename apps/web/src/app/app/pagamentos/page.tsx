import {
  ReceiptText,
} from 'lucide-react';

export default function PagamentosPage() {
  return (
    <section className="coming-page">
      <div className="coming-icon">
        <ReceiptText
          size={25}
        />
      </div>

      <p className="panel-kicker">
        Fechamento
      </p>

      <h2>
        Seus pagamentos
      </h2>

      <p>
        Esta área será conectada
        aos fechamentos semanais
        quando implementarmos a
        Etapa 11.
      </p>
    </section>
  );
}