# Funciones compartidas por dev.sh y verify.sh (se cargan con: . scripts/lib-ports.sh)
# free_port <puerto>: termina lo que escuche en ese puerto (Windows: netstat+taskkill; Unix: lsof o fuser).
free_port(){
  local p="$1" pid
  case "$(uname -s)" in
    MINGW*|MSYS*|CYGWIN*)
      for pid in $(netstat -ano 2>/dev/null | awk -v p=":$p" '$2 ~ p"$" && $4=="LISTENING" {print $5}' | sort -u); do
        taskkill //F //T //PID "$pid" >/dev/null 2>&1; done ;;
    *)
      if command -v lsof >/dev/null 2>&1; then
        for pid in $(lsof -ti "tcp:$p" -sTCP:LISTEN 2>/dev/null); do kill "$pid" 2>/dev/null; done
      elif command -v fuser >/dev/null 2>&1; then fuser -k "$p/tcp" >/dev/null 2>&1; fi ;;
  esac
}
