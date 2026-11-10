## ADDED Requirements

### Requirement: Pestañas de Administración táctiles en celular
Las pestañas de áreas y de secciones de Administración MUST medir al menos 44 px de alto en pantallas de menos de 768 px y SHALL ser compactas desde 768 px, con las mismas etiquetas y direcciones. (RNF-001, RNF-010)

#### Scenario: Celular
- **WHEN** un Administrador abre Administración en una pantalla de 375 px
- **THEN** cada pestaña de área y de sección mide al menos 44 px de alto

#### Scenario: Escritorio
- **WHEN** la pantalla mide 1280 px
- **THEN** las pestañas mantienen su alto compacto
