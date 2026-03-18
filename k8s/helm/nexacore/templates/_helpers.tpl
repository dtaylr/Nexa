{{/*
Expand the name of the chart.
*/}}
{{- define "nexacore.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
*/}}
{{- define "nexacore.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}

{{/*
Common labels
*/}}
{{- define "nexacore.labels" -}}
helm.sh/chart: {{ printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
app.kubernetes.io/part-of: nexacore
{{- end }}

{{/*
Selector labels for the API
*/}}
{{- define "nexacore.api.selectorLabels" -}}
app.kubernetes.io/name: {{ include "nexacore.fullname" . }}-api
app.kubernetes.io/component: backend
{{- end }}

{{/*
Selector labels for the Web
*/}}
{{- define "nexacore.web.selectorLabels" -}}
app.kubernetes.io/name: {{ include "nexacore.fullname" . }}-web
app.kubernetes.io/component: frontend
{{- end }}

{{/*
Image reference helper
*/}}
{{- define "nexacore.apiImage" -}}
{{ .Values.global.imageRegistry }}/{{ .Values.api.image.repository }}:{{ .Values.api.image.tag }}
{{- end }}

{{- define "nexacore.webImage" -}}
{{ .Values.global.imageRegistry }}/{{ .Values.web.image.repository }}:{{ .Values.web.image.tag }}
{{- end }}
