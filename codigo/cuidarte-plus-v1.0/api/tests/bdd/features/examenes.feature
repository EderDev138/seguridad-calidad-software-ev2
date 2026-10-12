# language: es
Característica: Gestion de examenes medicos y control de acceso por rol
  Como centro de salud que opera Cuidarte+
  quiero que los examenes medicos solo los gestione personal clinico
  para proteger la informacion clinica de los pacientes (RB-1, RB-3, NFR-SEG-4)

  Antecedentes:
    Dado un centro de salud con un medico, un administrador y dos pacientes registrados

  @RF-3.1 @RB-3
  Escenario: Un medico registra un examen a un paciente
    Cuando el medico registra un examen "Hemograma" al paciente "Ana Perez"
    Entonces el examen queda registrado para "Ana Perez"
    Y la auditoria contiene la accion "CREAR_EXAMEN"

  @RB-1 @NFR-SEG-4
  Escenario: Un paciente no puede registrar un examen
    Cuando el paciente "Ana Perez" intenta registrar un examen "Examen inventado"
    Entonces la operacion es rechazada por falta de permisos
    Y "Ana Perez" no tiene examenes registrados

  @RF-4.1 @RB-1
  Escenario: Un paciente visualiza unicamente sus propios examenes
    Dado que el medico registro un examen "Hemograma" al paciente "Ana Perez"
    Y que el medico registro un examen "Radiografia" al paciente "Bruno Soto"
    Cuando el paciente "Ana Perez" consulta sus examenes
    Entonces obtiene 1 examen
    Y entre sus examenes no aparece "Radiografia"

  @RB-1 @OWASP-A01
  Escenario: Un paciente no accede a los examenes de otro paciente
    Dado que el medico registro un examen "Radiografia" al paciente "Bruno Soto"
    Cuando el paciente "Ana Perez" intenta consultar los examenes de "Bruno Soto"
    Entonces la consulta no devuelve informacion del otro paciente

  @RF-3.3
  Escenario: La eliminacion de un examen es logica y queda auditada
    Dado que el medico registro un examen "Hemograma" al paciente "Ana Perez"
    Cuando el medico elimina ese examen
    Entonces el examen deja de aparecer entre los examenes activos
    Y el registro del examen se conserva marcado como eliminado
    Y la auditoria contiene la accion "ELIMINAR_EXAMEN"

  @RB-2
  Escenario: Solo el administrador consulta el registro de auditoria
    Cuando el paciente "Ana Perez" intenta consultar la auditoria
    Entonces la operacion es rechazada por falta de permisos
    Pero el administrador si puede consultar la auditoria
