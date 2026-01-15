# Deployment Checklist (Frontend)

## Build
- npm ci
- npm test
- npm run build -- --configuration production

## Hosting
- Serve dist/fxn-erp-frontend via Nginx/static hosting
- Enable HTTPS
- Configure SPA fallback to index.html

## Backend Integration
- Ensure API base URL is correct in environment
- Verify CORS allows the frontend origin

## Smoke Tests
- Login flow
- Role-based redirects
- Create/update resources
- Check history pages
