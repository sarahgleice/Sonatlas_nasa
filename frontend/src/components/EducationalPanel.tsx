import React from 'react';
import { X } from 'lucide-react';
import { RegionDataset } from '../types/dataset';
import { formatTimestamp } from '../utils/formatters';
import { SHORTCUTS } from '../types/player';
import { useModalDialog } from '../accessibility/useModalDialog';

interface EducationalPanelProps {
  isOpen: boolean;
  dataset: RegionDataset | null;
  loading: boolean;
  error: string | null;
  onClose: () => void;
}

export const EducationalPanel: React.FC<EducationalPanelProps> = ({ isOpen, dataset, loading, error, onClose }) => {
  const { dialogRef, handleClose, handleBackdropClick, requestClose } = useModalDialog(isOpen, onClose);
  const firstObservation = dataset?.observations[0];
  const lastObservation = dataset?.observations[dataset.observations.length - 1];
  const period = firstObservation && lastObservation
    ? `${formatTimestamp(firstObservation.timestamp_utc)} — ${formatTimestamp(lastObservation.timestamp_utc)}`
    : 'Não disponível no dataset';

  return (
    <dialog ref={dialogRef} className="educational-dialog" aria-labelledby="educational-title" onClose={handleClose} onClick={handleBackdropClick}>
      <div className="dialog-surface">
      <div className="educational-header">
        <div><span className="panel-index">GUIA DE EXPLORAÇÃO</span><h2 id="educational-title">Como interpretar esta exploração</h2></div>
        <button type="button" className="btn-close" onClick={requestClose} aria-label="Fechar guia">
          <X size={20} aria-hidden="true" />
        </button>
      </div>
      <div className="educational-content">
        <h3>O que é o Sonatlas?</h3>
        <p>O Sonatlas ajuda a explorar dados científicos da Terra com mapas, indicadores, texto e áudio. O objetivo é tornar padrões ambientais perceptíveis por mais de um sentido. O mapa é complementar: valores e controles também estão disponíveis em texto.</p>
        {loading ? <p role="status">Carregando metadados da região…</p> : error ? <p role="alert">Metadados indisponíveis: {error}</p> : dataset ? (
          <>
            <h3>Sobre os dados carregados</h3>
            <dl className="educational-metadata">
              <div><dt>Fenômeno</dt><dd>{dataset.phenomenon}</dd></div>
              <div><dt>Variável/indicador</dt><dd>{firstObservation?.scientific_indicators.mean_precipitation_rate.description ?? 'Taxa média de precipitação'}</dd></div>
              <div><dt>Unidade</dt><dd>{firstObservation?.scientific_indicators.mean_precipitation_rate.unit ?? 'Não disponível no dataset'}</dd></div>
              <div><dt>Região</dt><dd>{dataset.region_name}, {dataset.country}</dd></div>
              <div><dt>Período observado</dt><dd>{period}</dd></div>
              <div><dt>Fonte</dt><dd>{dataset.data_source}</dd></div>
              <div><dt>Produto</dt><dd>{dataset.product_name} · {dataset.product_version}</dd></div>
              <div><dt>Resolução temporal</dt><dd>{dataset.temporal_resolution.replace(/_/g, ' ')}</dd></div>
              <div><dt>Validação</dt><dd>{dataset.validation_status === 'preliminary_verified' ? 'Verificação preliminar' : 'Candidato em avaliação'}</dd></div>
              {dataset.note && <div><dt>Nota</dt><dd>{dataset.note}</dd></div>}
            </dl>
            {dataset.is_sample && <p className="educational-sample">Amostra técnica: estes valores não são observações NASA verificadas.</p>}
            {dataset.metadata_url && /^https?:\/\//i.test(dataset.metadata_url) && <p><a href={dataset.metadata_url} target="_blank" rel="noreferrer">Consultar referência dos metadados</a></p>}
          </>
        ) : <p role="status">Os metadados estarão disponíveis quando uma região for carregada.</p>}
        <h3>Leitura dos indicadores e do som</h3>
        <p><strong>mm/h</strong> é uma taxa de precipitação por hora no instante observado; não é a quantidade acumulada em mm. Uma observação válida de <strong>0 mm/h</strong> indica que não foi detectada precipitação. Um período ausente significa que não há medição utilizável e não pode ser interpretado como zero.</p>
        <p>Nesta implementação, a taxa média altera a altura do tom e a fração da área com chuva altera a quantidade de pulsos. Períodos sem dados recebem um sinal de alerta. O áudio é uma representação complementar, não uma gravação da chuva nem substituto dos valores.</p>
        <h3>Guia rápido</h3>
        <ol>
          <li>Confira a região e o estado de amostra nos dados apresentados.</li>
          <li>Selecione uma observação no gráfico ou na linha temporal.</li>
          <li>Leia a taxa, unidade e disponibilidade junto ao período selecionado.</li>
          <li>Use reproduzir/pausar ou avance e retroceda para ouvir outros períodos.</li>
        </ol>
        <details>
          <summary>Atalhos de teclado</summary>
          <ul>
            {SHORTCUTS.map((shortcut) => (
              <li key={shortcut.keys}><kbd>{shortcut.keys}</kbd> {shortcut.description}</li>
            ))}
          </ul>
        </details>
      </div>
      </div>
    </dialog>
  );
};
