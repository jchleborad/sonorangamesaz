document.addEventListener("DOMContentLoaded", function () {
  console.log("✅ nflpool-data.js loaded and DOM ready");

  const baseURL = "https://script.google.com/macros/s/AKfycbxfXCHCG_oGZXWlZvtE9TRsvdZa5loPe9G0X9YtD1KnWWomg3A5G6CvkX2zXi0wq_yM/exec";

  const sections = [
    { action: "matchups", containerId: "matchup-table-container" },
    { action: "results", containerId: "results-table-container" },
    { action: "standings", containerId: "standings-table-container" }
  ];

// Fetch just the Week title from Matchups for top display
fetch(`${baseURL}?action=matchups`)
  .then(res => res.json())
  .then(data => {
    if (data.title) {
      const weekDiv = document.createElement("div");
      weekDiv.classList.add("nfl-week-title", "mb-2", "text-white", "text-center");
      weekDiv.textContent = data.title;

      const container = document.getElementById("week-title-container");
      if (container) container.appendChild(weekDiv);
    }
  })
  .catch(err => {
    console.error("❌ Error fetching week title:", err);
  });


  sections.forEach(({ action, containerId }) => {
    const container = document.getElementById(containerId);
    fetch(`${baseURL}?action=${action}`)
      .then(res => res.json())
      .then(data => {
        container.innerHTML = "";

        const table = buildTable(data.headers, data[action]);
        container.appendChild(table);
      })
      .catch(err => {
        console.error(`❌ Error loading ${action}:`, err);
        container.innerHTML = `<p class="text-danger">Failed to load ${action}.</p>`;
      });
  });

  const picksButton = document.getElementById("toggle-picks-btn");
  const picksSection = document.getElementById("player-picks");
  const picksContainer = document.getElementById("player-picks-table-container");

  if (picksButton) {
    picksButton.addEventListener("click", function () {
      if (picksSection.style.display === "none") {
        fetch(`${baseURL}?action=picks`)
          .then(res => res.json())
          .then(data => {
            picksContainer.innerHTML = "";
            const table = buildTable(data.headers, data.picks);
            picksContainer.appendChild(table);
            picksSection.style.display = "block";
            picksButton.textContent = "Hide Player Picks";
          })
          .catch(err => {
            console.error("❌ Error loading player picks:", err);
            picksContainer.innerHTML = "<p class='text-danger'>Failed to load player picks.</p>";
            picksSection.style.display = "block";
          });
      } else {
        picksSection.style.display = "none";
        picksButton.textContent = "Show Player Picks";
      }
    });
  }

  function buildTable(headers, rows) {
    const table = document.createElement("table");
    table.className = "table table-striped table-bordered table-sm";

    const thead = document.createElement("thead");
    const headRow = document.createElement("tr");
    headers.forEach(header => {
      const th = document.createElement("th");
      th.textContent = header;
      headRow.appendChild(th);
    });
    thead.appendChild(headRow);
    table.appendChild(thead);

    const tbody = document.createElement("tbody");
    rows.forEach(row => {
      const tr = document.createElement("tr");
      headers.forEach(header => {
        const td = document.createElement("td");
        td.textContent = row[header] || "";
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);

    return table;
  }
});
